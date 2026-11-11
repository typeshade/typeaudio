"""The random numbers of `src/study/rng.ts`, in numpy. `use(dsp)` puts them in place of numpy's
generator in the study's scripts, so that the study and the engine's port draw the same numbers."""
import numpy as np

M = np.uint32(0xFFFFFFFF)


def h32(x):
    x = np.asarray(x, dtype=np.uint32)
    x = x ^ (x >> np.uint32(16))
    x = x * np.uint32(0x7feb352d)
    x = x ^ (x >> np.uint32(15))
    x = x * np.uint32(0x846ca68b)
    return x ^ (x >> np.uint32(16))


class SharedRng:
    def __init__(self, seed):
        seed = int(seed)
        lo = np.uint32(seed & 0xFFFFFFFF)
        hi = np.uint32((seed >> 32) & 0xFFFFFFFF)
        self.key = h32(lo ^ h32(hi ^ np.uint32(0x9e3779b9)))
        self.counter = 0

    def _draw(self, n):
        c = (np.arange(n, dtype=np.uint64) + np.uint64(self.counter)) & np.uint64(0xFFFFFFFF)
        self.counter = (self.counter + n) & 0xFFFFFFFF
        c2 = (c * np.uint64(2)) & np.uint64(0xFFFFFFFF)
        a = h32(self.key ^ h32(c2.astype(np.uint32)))
        b = h32(self.key ^ h32(((c2 + np.uint64(1)) & np.uint64(0xFFFFFFFF)).astype(np.uint32)))
        return ((a >> np.uint32(5)).astype(np.float64) * 67108864.0 + (b >> np.uint32(6)).astype(np.float64)) / 9007199254740992.0

    def _one(self):
        return float(self._draw(1)[0])

    @staticmethod
    def _n(size):
        if size is None:
            return None
        return int(np.prod(size))

    def random(self, size=None):
        n = self._n(size)
        return self._one() if n is None else self._draw(n)

    def uniform(self, low=0.0, high=1.0, size=None):
        n = self._n(size)
        u = self._one() if n is None else self._draw(n)
        return low + (high - low) * u

    def standard_normal(self, size=None):
        n = self._n(size)
        k = 1 if n is None else n
        u = self._draw(2 * k)
        z = np.sqrt(-2.0 * np.log(1.0 - u[0::2])) * np.cos(2.0 * np.pi * u[1::2])
        return float(z[0]) if n is None else z

    def exponential(self, scale=1.0, size=None):
        n = self._n(size)
        u = self._one() if n is None else self._draw(n)
        return -np.log(1.0 - u) * scale

    def poisson(self, lam):
        lam = float(lam)
        if lam <= 0:
            return 0
        if lam <= 30:
            limit = np.exp(-lam)
            k = 0
            p = self._one()
            while p > limit:
                k += 1
                p *= self._one()
            return k
        return max(0, int(np.floor(lam + np.sqrt(lam) * self.standard_normal() + 0.5)))

    def integers(self, low, high=None):
        return int(low + np.floor(self._one() * (high - low)))

    def choice(self, a, size=None):
        n = self._n(size)
        u = self._draw(1 if n is None else n)
        out = np.where(u < 0.5, a[0], a[1])
        return float(out[0]) if n is None else out


def use(dsp):
    dsp.rng = lambda seed: SharedRng(seed)
