import Base

def f32(u: U32) -> F32:
  match u:
    case U32{w}:
      F32{w}

def show(r: Array<U32> & U32, +i: U32) -> IO(Unit):
  (o, v) = r
  _ = o
  IO.print(U32.show(i) ++ " " ++ U32.show(v))

def first(r: Array<U32> & U32) -> IO(Unit):
  (o, +i) = r
  show(Array.get(U32, o, 1), i)

def done(o: Array<U32>, a: Array<F32>) -> IO(Unit):
  _ = a
  first(Array.get(U32, o, 0))

def out(r: Array<F32> & Array<U32>) -> IO(Unit):
  (a, o) = r
  done(o, Array.q4wait(a))

def main() -> IO(Unit):
  do IO<Unit>:
    out(Array.amq(Array.new(F32, 0n, 0.0), Array.new(U32, 1n, 0), 0))
    out(Array.amq(Array.set(F32, Array.set(F32, Array.new(F32, 12n, 0.0), 333, 7.0), 3050, 7.0), Array.new(U32, 1n, 0), 4096))
    out(Array.amq(Array.set(F32, Array.new(F32, 1n, 0.0), 0, f32(2147483648)), Array.new(U32, 1n, 0), 2))
    out(Array.amq(Array.set(F32, Array.set(F32, Array.new(F32, 2n, 1.0), 1, f32(2143289344)), 3, 5.0), Array.new(U32, 1n, 0), 4))
#|0 0
#|333 1088421888
#|0 0
#|3 1084227584
