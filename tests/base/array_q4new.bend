# Queued zero fills survive reuse after dirtying and freeing every slot.
# All reads follow q4wait; exercising large blocks also covers host links.
import Base

def bits(+v: F32) -> U32:
  match v:
    case F32{+w}:
      U32{w}

def cell(r: Array<F32> & F32, +bad: U32, +i: U32) -> Array<F32> & U32:
  (a, +x) = r
  (Array.set(F32, a, i, 7.0), (bad .|. bits(x) : U32))

def check(n: Nat, r: Array<F32> & U32, +i: U32) -> Array<F32> & U32:
  match n:
    case 0n:
      r
    case 1n+p:
      (a, +bad) = r
      check(p, cell(Array.get(F32, a, i), bad, i), (i + 1 : U32))

def drop(r: Array<F32> & U32) -> U32:
  (a, +bad) = r
  _ = a
  bad

def repeat(n: Nat, +bad: U32) -> U32:
  match n:
    case 0n:
      bad
    case 1n+p:
      repeat(p, (bad .|. drop(check(4096n, (Array.q4wait(Array.q4new(12n)), 0), 0)) : U32))

# A fresh zero input is filled before SwiGLU reads it; the output writer
# supplies its values and preserves the untouched output padding as zero.
def swread(o: Array<F32>, a: Array<F32>) -> U32:
  _ = a
  drop(check(256n, (o, 0), 0))

def swfin(r: Array<F32> & Array<F32>) -> U32:
  (a, o) = r
  swread(Array.q4wait(o), a)

def main() -> IO(Unit):
  do IO<Unit>:
    IO.print(U32.show(repeat(64n, 0)))
    IO.print(U32.show(drop(check(1n, (Array.q4wait(Array.q4new(0n)), 0), 0))))
    IO.print(U32.show(swfin(Array.swq(Array.q4new(8n), Array.q4new(8n), 128))))
#|0
#|0
#|0
