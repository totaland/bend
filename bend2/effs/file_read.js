// File
// ====

// read(2) answers what is there, not what was asked: a pipe, a terminal
// and a short read all stop before max. Fill the buffer or reach EOF, so
// a caller that asked for n bytes gets n unless the file ends first; a
// line stops after its '\n', read a byte at a time so nothing past it
// leaves the file. An error after some bytes answers them (a pipe has
// already given them up). readvSync makes the syscall even for 0 bytes
// (Bun's readSync skips it), so a 0-byte read of a bad handle fails as C
// does, and it needs no bun:ffi, which node lacks.
// max is a cap, not a size: the buffer starts at what a regular file holds
// past the given offset (one byte more, to see its end) or 64 KiB. It doubles
// up to max as bytes arrive, so a read capped far above the available data
// commits only what it reads (#1983). A line starts at 64 KiB whatever the file.
function file_read_room(fs, file, len, line, offset) {
  let room = 65536;
  try {
    // A cap within room already determines the buffer size.
    const st = line || len <= room ? null : fs.fstatSync(file);
    if (st?.isFile()) {
      room = Math.max(room, st.size - (offset ?? 0) + 1);
    }
  } catch {}
  return Math.max(Math.min(len, room), 1);
}

function file_read_with(file, max, offset, pack, line = false) {
  const fs = require("fs");
  const len = Math.min(max, 2147483647);
  let b = new Uint8Array(file_read_room(fs, file, len, line, offset));
  let got = 0;
  do {
    if (got === b.length) {
      const c = new Uint8Array(Math.min(len, b.length * 2));
      c.set(b);
      b = c;
    }
    const want = line && got < len ? 1 : Math.min(b.length, len) - got;
    let n;
    try {
      n = fs.readvSync(file, [b.subarray(got, got + want)],
        offset === null ? null : offset + got);
    } catch (e) {
      // libuv retries EINTR for most calls, but not for read
      if (Math.abs(e.errno) === 4) {
        continue;
      }
      if (got === 0) {
        return io_tup(file, io_fail(Math.abs(e.errno ?? 5)));
      }
      break;
    }
    if (n === 0) {
      break;
    }
    got += n;
  } while (got < len && !(line && b[got - 1] === 10));
  return io_tup(file, io_done(pack(b, got)));
}

function file_read(file, max, k) {
  io_park_on(undefined, 0, k,
    () => file_read_with(file, max, null, io_text), 0);
}

function file_read_line(file, max, k) {
  io_park_on(undefined, 0, k,
    () => file_read_with(file, max, null, io_text, true), 0);
}

function file_read_bytes(file, max, k) {
  io_park_on(undefined, 0, k,
    () => file_read_with(file, max, null, io_list), 0);
}

function file_read_at(file, offset, max, k) {
  io_park_on(undefined, 0, k,
    () => file_read_with(file, max, offset, io_list), 0);
}

io_eff(CID(File.read), file_read);
io_eff(CID(File.read_line), file_read_line);
io_eff(CID(File.read_bytes), file_read_bytes);
io_eff(CID(File.read_at), file_read_at);

// Slot at + i/4 takes bytes i..i+3 little-endian; a last partial slot
// keeps its high bytes, as the C block does. It reads in bounded chunks,
// so a large array with a small file allocates only what it reads.
function file_read_byte(a, at, i, x) {
  const s = at + (i >>> 2), k = (i & 3) * 8;
  a[s] = ((a[s] & ~(0xff << k)) | (x << k)) >>> 0;
}

function file_read_into(file, offset, max, a, at) {
  const sys = io_sys();
  const len = Math.max(0, Math.min(max, (a.length - at) * 4));
  const b = new Uint8Array(Math.max(Math.min(len, 1 << 24), 1));
  let got = 0;
  while (got < len) {
    const n = Number(sys.pread(file, sys.ptr(b), Math.min(len - got, b.length),
      BigInt(offset + got)));
    if (n < 0) {
      return io_tup(file, io_tup(a, io_fail(sys.errno())));
    }
    let i = 0;
    for (; i < n && ((got + i) & 3) !== 0; i += 1) {
      file_read_byte(a, at, got + i, b[i]);
    }
    for (; i + 4 <= n; i += 4) {
      a[at + ((got + i) >>> 2)] =
        (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
    }
    for (; i < n; i += 1) {
      file_read_byte(a, at, got + i, b[i]);
    }
    if (n === 0) {
      break;
    }
    got += n;
  }
  return io_tup(file, io_tup(a, io_done(got)));
}

io_eff(CID(File.read_into), file_read_into);
