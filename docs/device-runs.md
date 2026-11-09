# Device runs

This document gives the procedure for a device run. A device run is the harness of an experiment
on the owner's machine, with the machine's own GPU. The browser opens a window, and the GPU of
that machine renders the page. The record of the run goes to `docs/records/0N-<experiment>-<device>.md`,
beside the container record `docs/records/0N-<experiment>-container.md`.

The device name is `<gpu>-<os>` in lower case. Examples: `rtx4070-win11`, `m2-macos15`. The name
tells the reader which machine ran the record.

A device run uses two environment variables:

- `TYPESHADE_CHROMIUM` names the `chrome` binary that the harness opens.
- `TYPESHADE_GPU` set to `device` opens a window on the machine's GPU, with Chrome's default flags.
  Unset, or set to `swiftshader`, the harness runs headless on the software GPU of the container.

## Experiment 8 on Windows (PowerShell)

1. Install Bun. Run `powershell -c "irm bun.sh/install.ps1 | iex"`, then open a new terminal.
2. Install Node.js 22. The container record used Node v22.23.4. The CPU tier runs in Node.
3. Clone the repository. Run `git clone https://github.com/typeshade/typeaudio.git`.
4. Enter the repository. Run `cd typeaudio`.
5. Check out the commit that the record will name. Run `git checkout <commit>`.
6. Install the dependencies. Run `bun install`.
7. Name the Chrome binary. Run `$env:TYPESHADE_CHROMIUM = "C:\Program Files\Google\Chrome\Application\chrome.exe"`.
8. Select the device GPU. Run `$env:TYPESHADE_GPU = "device"`.
9. Run the WebGPU and WebGL2 tiers. Run `bun run exp:08 --tier webgpu,webgl2 --out docs/records/08-sound-design-<device>.json`.
10. Do not touch the Chrome window that the run opens. Wait for the run to finish.
11. Run the CPU tier on its own. Run `bun run exp:08 --tier cpu --out docs/records/08-sound-design-<device>-cpu.json`.
12. Keep the console output of both runs. Save it to a text file.
13. Bring the two JSON files and the console output back to the conversation, or commit them on a branch `device/<device>` and push it.

The CPU tier runs separately because a whole-clip CPU pass took 28.8 minutes on the container
(`docs/records/08-sound-design-container.md`, observation on the CPU tier).

## Experiment 8 on macOS (zsh)

1. Install Bun. Run `curl -fsSL https://bun.sh/install | bash`, then open a new terminal.
2. Install Node.js 22. The CPU tier runs in Node.
3. Clone the repository. Run `git clone https://github.com/typeshade/typeaudio.git`.
4. Enter the repository. Run `cd typeaudio`.
5. Check out the commit that the record will name. Run `git checkout <commit>`.
6. Install the dependencies. Run `bun install`.
7. Name the Chrome binary. Run `export TYPESHADE_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
8. Select the device GPU. Run `export TYPESHADE_GPU=device`.
9. Run the WebGPU and WebGL2 tiers. Run `bun run exp:08 --tier webgpu,webgl2 --out docs/records/08-sound-design-<device>.json`.
10. Do not touch the Chrome window that the run opens. Wait for the run to finish.
11. Run the CPU tier on its own. Run `bun run exp:08 --tier cpu --out docs/records/08-sound-design-<device>-cpu.json`.
12. Keep the console output of both runs. Save it to a text file.
13. Bring the two JSON files and the console output back to the conversation, or commit them on a branch `device/<device>` and push it.

## Experiments 1 to 7

The steps are the same as for experiment 8. Change two things:

1. Run the script of the experiment, not `exp:08`.
2. Use the options that the header of that experiment's `run.ts` documents.

The table gives each script, its tier options, and the duration that its container record states.
A duration of "not stated" means that no container record states it.

| Experiment | Script   | Tier option                            | Container duration (record)                                                             |
| ---------- | -------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| 1          | `exp:01` | `--tier cpu\|webgpu\|webgl2\|all`      | 5 minutes (`docs/records/01-round-trip-container.md`)                                   |
| 2          | `exp:02` | `--parts`, `--voices`, `--variants`    | 7 minutes (`docs/records/02-worklet-container.md`)                                      |
| 3          | `exp:03` | `--tier all\|cpu,oracle,webgpu,webgl2` | 2 minutes 34 seconds (`docs/records/03-fft-container.md`)                               |
| 4          | `exp:04` | `--tier cpu\|webgpu\|webgl2\|all`      | About 2 hours 23 minutes for nine invocations (`docs/records/04-additive-container.md`) |
| 5          | `exp:05` | `--tier all\|cpu,oracle,webgpu,webgl2` | 32 minutes 9 seconds (`docs/records/05-convolution-container.md`)                       |
| 6          | `exp:06` | `--tier cpu\|webgpu\|webgl2\|all`      | 11 minutes 20 seconds (`docs/records/06-granular-container.md`)                         |
| 7          | `exp:07` | `--tier all\|cpu,oracle,webgpu,webgl2` | 42 minutes 8 seconds (`docs/records/07-sound-match-container.md`)                       |
| 8          | `exp:08` | `--tier all\|cpu,webgpu,webgl2`        | About 52 minutes for the whole-clip run (`docs/records/08-sound-design-container.md`)   |

The durations are the container's. A device run can take a different time.

## What a device record holds

An agent writes the record of a device run from the JSON that the run writes. The owner does not
write the record. The record has the form of the container records:

1. A run table. It holds the command, the date, the commit, the compiler pin and the tools.
2. A devices table. It holds the device information that the JSON reports for each tier.
3. The numbers, with their statistics as the JSON gives them.
4. What departs from the container record, and from the expected result. The record names each
   departure and its cause, or says that the cause is not known.

The record names the device with `<gpu>-<os>`. It also names the `TYPESHADE_GPU` value used.
