// The code a part of a mix depends on, read from the scene's sources (`Mix.part`, `build.ts`). A
// part's key holds its own text and the text of every module-level declaration it reaches, in its
// file and in the scene files it imports, so a change to a part, to a helper it calls or to a
// constant it reads changes its key, and a change elsewhere does not. The study's models
// (`src/study/`) enter every key whole (`build.ts`).
//
// A part may read only its own bindings, the module's, the globals and the mix it is called on, so
// the check refuses a part that reads a binding of the function around it, that changes a module
// binding, or that reads the mix's layers. A refused part is a scene error: the build stops and
// says which part and which name.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

/** What the parts and the layer steps of a scene depend on. */
export interface SceneKeys {
  /** For each part name, the hash of its code and of what it reaches. */
  readonly parts: ReadonlyMap<string, string>;
  /** For each layer step name (`Mix.eachLayer`), the same. */
  readonly steps: ReadonlyMap<string, string>;
  /** The files read, the entry first. */
  readonly files: readonly string[];
}

interface Decl {
  readonly file: string;
  readonly name: string;
  readonly node: ts.Node;
}

interface FileInfo {
  readonly path: string;
  readonly src: ts.SourceFile;
  /** Module-level declarations by name. */
  readonly decls: Map<string, Decl>;
  /** Imported names that come from another scene file: local name to [file, exported name]. */
  readonly links: Map<string, [string, string]>;
  /** Imported names from anywhere else (the study's models, node): covered by the study's hash. */
  readonly outside: Set<string>;
  /** The text of the module's statements that are no declaration (run on import). */
  readonly loose: string;
}

/** The methods that change an array, a map or a set in place. */
const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'set',
  'copyWithin',
  'delete',
  'clear',
]);

/** What a part may use of the mix it is called on. */
const MIX_USES = new Set(['add', 'addWide', 'positions', 't0', 't1', 'tail', 'n', 'room', 'ir']);

function bindingNames(n: ts.BindingName, out: Set<string>): void {
  if (ts.isIdentifier(n)) out.add(n.text);
  else
    for (const e of n.elements) {
      if (!ts.isOmittedExpression(e)) bindingNames(e.name, out);
    }
}

/** Every name a node declares anywhere inside it (variables, parameters, functions, classes). */
function declaredIn(node: ts.Node): Set<string> {
  const out = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) {
      if (!ts.isBindingElement(n) || ts.isIdentifier(n.name)) bindingNames(n.name, out);
    }
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassDeclaration(n)) && n.name)
      out.add(n.name.text);
    if (ts.isCatchClause(n) && n.variableDeclaration) bindingNames(n.variableDeclaration.name, out);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** The identifiers a node uses as values, not as property names or types. */
function usedIn(node: ts.Node): ts.Identifier[] {
  const out: ts.Identifier[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isTypeNode(n) || ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) return;
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isName =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isMethodDeclaration(p) && p.name === n) ||
        (ts.isPropertyDeclaration(p) && p.name === n) ||
        (ts.isBindingElement(p) && p.propertyName === n);
      if (!isName) out.push(n);
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

const STUDY = dirname(new URL(import.meta.url).pathname);

function readFile(path: string): FileInfo {
  const text = readFileSync(path, 'utf8');
  const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const decls = new Map<string, Decl>();
  const links = new Map<string, [string, string]>();
  const outside = new Set<string>();
  const loose: string[] = [];
  for (const st of src.statements) {
    if (ts.isImportDeclaration(st)) {
      const spec = (st.moduleSpecifier as ts.StringLiteral).text;
      const target = spec.startsWith('.') ? resolve(dirname(path), spec) : null;
      const inScene = target !== null && !target.startsWith(STUDY + sep);
      const clause = st.importClause;
      if (!clause || clause.isTypeOnly) continue;
      const names: [string, string][] = [];
      if (clause.name) names.push([clause.name.text, 'default']);
      const nb = clause.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) names.push([nb.name.text, '*']);
      if (nb && ts.isNamedImports(nb))
        for (const e of nb.elements)
          if (!e.isTypeOnly) names.push([e.name.text, (e.propertyName ?? e.name).text]);
      for (const [local, exported] of names) {
        if (inScene) links.set(local, [target!, exported]);
        else outside.add(local);
      }
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const names = new Set<string>();
        bindingNames(d.name, names);
        for (const name of names) decls.set(name, { file: path, name, node: st });
      }
    } else if (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) {
      if (st.name) decls.set(st.name.text, { file: path, name: st.name.text, node: st });
    } else if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) {
      // types do not run
    } else if (ts.isExportDeclaration(st) || ts.isExportAssignment(st)) {
      loose.push(st.getText(src));
    } else loose.push(st.getText(src));
  }
  return { path, src, decls, links, outside, loose: loose.join('\n') };
}

const isLet = (d: Decl): boolean =>
  ts.isVariableStatement(d.node) && (d.node.declarationList.flags & ts.NodeFlags.Const) === 0;

/** The keys of a scene's parts and layer steps, from its entry module. Throws on a refused part. */
export function sceneKeys(entry: string): SceneKeys {
  const files = new Map<string, FileInfo>();
  const queue = [resolve(entry)];
  while (queue.length > 0) {
    const path = queue.shift()!;
    if (files.has(path)) continue;
    const info = readFile(path);
    files.set(path, info);
    for (const [target] of info.links.values()) if (!files.has(target)) queue.push(target);
  }

  /** The declaration a name in a file stands for, following imports between scene files. */
  const resolveName = (file: string, name: string): Decl | 'outside' | null => {
    const info = files.get(file)!;
    const d = info.decls.get(name);
    if (d) return d;
    if (info.outside.has(name)) return 'outside';
    const link = info.links.get(name);
    if (link) {
      const [target, exported] = link;
      if (exported === '*' || exported === 'default') return 'outside';
      return resolveName(target, exported);
    }
    return null;
  };

  /** The declarations a node reaches, transitively, as sorted "file:name" keys with their text. */
  const reach = (file: string, node: ts.Node, seen = new Map<string, Decl>()): Map<string, Decl> => {
    const own = declaredIn(node);
    for (const id of usedIn(node)) {
      if (own.has(id.text)) continue;
      const d = resolveName(file, id.text);
      if (d === null || d === 'outside') continue;
      const k = `${d.file}:${d.name}`;
      if (seen.has(k)) continue;
      seen.set(k, d);
      reach(d.file, d.node, seen);
    }
    return seen;
  };

  // a file by its place from the entry, so that a copy of the scene elsewhere has the same keys
  const root = resolve(entry);
  const label = (file: string): string => (file === root ? '' : relative(dirname(root), file));
  const keyOf = (file: string, kind: string, name: string, node: ts.Node): string => {
    const h = createHash('sha256');
    const info = files.get(file)!;
    h.update(`${kind}\0${name}\0${node.getText(info.src)}\0`);
    const deps = [...reach(file, node).values()]
      .map((d) => [`${label(d.file)}:${d.name}`, d] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    for (const [k, d] of deps) h.update(`${k}\0${d.node.getText(files.get(d.file)!.src)}\0`);
    // statements that run on import, in every file
    for (const f of files.values()) h.update(`${label(f.path)}\0${f.loose}\0`);
    return h.digest('hex');
  };

  const parts = new Map<string, string>();
  const steps = new Map<string, string>();
  const problems: string[] = [];

  for (const info of files.values()) {
    const where = (n: ts.Node) => {
      const { line } = info.src.getLineAndCharacterOfPosition(n.getStart(info.src));
      return `${info.path}:${line + 1}`;
    };
    const visit = (n: ts.Node): void => {
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        (n.expression.name.text === 'part' || n.expression.name.text === 'eachLayer') &&
        n.arguments.length === 2
      ) {
        const method = n.expression.name.text;
        const [nameArg, fn] = n.arguments as unknown as [ts.Expression, ts.Expression];
        const receiver = n.expression.expression;
        if (!ts.isStringLiteral(nameArg) && !ts.isNoSubstitutionTemplateLiteral(nameArg)) {
          problems.push(`${where(n)}: the name of a ${method} must be a string literal`);
          return;
        }
        const name = nameArg.text;
        const table = method === 'part' ? parts : steps;
        if (table.has(name)) problems.push(`${where(n)}: a second ${method} named '${name}'`);
        if (method === 'part') checkPart(name, fn, receiver, info, where, problems, resolveName);
        table.set(name, keyOf(info.path, method, name, fn));
        // a part inside a part is refused when it runs (`build.ts`)
      }
      ts.forEachChild(n, visit);
    };
    visit(info.src);
  }
  if (problems.length > 0) throw new Error(`the scene's parts:\n  ${problems.join('\n  ')}`);
  return { parts, steps, files: [...files.keys()] };
}

function checkPart(
  name: string,
  fn: ts.Expression,
  receiver: ts.Expression,
  info: FileInfo,
  where: (n: ts.Node) => string,
  problems: string[],
  resolveName: (file: string, name: string) => Decl | 'outside' | null,
): void {
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) {
    problems.push(`${where(fn)}: part '${name}' must be written in place, as an arrow function`);
    return;
  }
  const mix = ts.isIdentifier(receiver) ? receiver.text : null;
  if (mix === null) problems.push(`${where(fn)}: part '${name}' must be called on a named mix`);
  const own = declaredIn(fn);
  const rootOf = (e: ts.Expression): ts.Identifier | null => {
    while (
      ts.isPropertyAccessExpression(e) ||
      ts.isElementAccessExpression(e) ||
      ts.isParenthesizedExpression(e) ||
      ts.isNonNullExpression(e)
    )
      e = e.expression;
    return ts.isIdentifier(e) ? e : null;
  };
  const moduleBinding = (id: ts.Identifier): Decl | 'outside' | null =>
    own.has(id.text) ? null : resolveName(info.path, id.text);
  for (const id of usedIn(fn)) {
    if (own.has(id.text)) continue;
    if (id.text === mix) {
      const p = id.parent;
      if (ts.isPropertyAccessExpression(p) && p.expression === id) {
        if (!MIX_USES.has(p.name.text))
          problems.push(`${where(id)}: part '${name}' uses ${mix}.${p.name.text}`);
        const pp = p.parent;
        if (ts.isBinaryExpression(pp) && pp.left === p && isAssignment(pp.operatorToken.kind))
          problems.push(`${where(id)}: part '${name}' sets ${mix}.${p.name.text}`);
      } else if (!(ts.isCallExpression(p) && p.arguments.includes(id)))
        problems.push(`${where(id)}: part '${name}' uses the mix ${mix} as a value`);
      // passed to a function: the function's code is in the key, and the mix holds only this
      // part's layers while it runs (`build.ts`), so a function that reads others fails loudly
      continue;
    }
    const d = resolveName(info.path, id.text);
    if (d === 'outside') continue;
    if (d !== null) {
      if (isLet(d)) problems.push(`${where(id)}: part '${name}' reads the module's let '${id.text}'`);
      continue;
    }
    if (id.text in globalThis || id.text === 'undefined') continue;
    problems.push(
      `${where(id)}: part '${name}' reads '${id.text}' from the code around it; move it into the part or to the module`,
    );
  }
  // changes to module bindings
  const visit = (n: ts.Node): void => {
    let target: ts.Expression | null = null;
    if (ts.isBinaryExpression(n) && isAssignment(n.operatorToken.kind)) target = n.left;
    if (
      (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
      (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)
    )
      target = n.operand;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      MUTATORS.has(n.expression.name.text)
    )
      target = n.expression.expression;
    if (target) {
      const root = rootOf(target);
      if (root && root.text !== mix) {
        const d = moduleBinding(root);
        if (d !== null && d !== 'outside')
          problems.push(`${where(n)}: part '${name}' changes the module's '${root.text}'`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(fn);
}

function isAssignment(k: ts.SyntaxKind): boolean {
  return k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment;
}
