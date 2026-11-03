export const fileLimit = 16 * 1024 * 1024;
const entryLimit = 2 * 1024 * 1024;
const decode = new TextDecoder("utf-8", { fatal: true });

function requireZip(condition, message) {
    if (!condition) throw new Error(message);
}

function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
    return (crc ^ -1) >>> 0;
}

export class ArchiveEntry {
    constructor(name, method, packed, size, checksum) {
        this.kind = /\.zip$/i.test(name) ? "zip" : /\.json$/i.test(name) ? "json" : /\.(txt|md|csv|log)$/i.test(name) ? "text" : "binary";
        this.method = method;
        this.packed = packed;
        this.size = size;
        this.checksum = checksum;
    }

    async open() {
        if (this.kind === "binary") return `Binary file, ${this.size} bytes`;
        requireZip(this.size <= entryLimit, "This entry exceeds the 2 MiB preview limit.");
        const bytes = this.method === 0 ? this.packed : await this.inflate();
        requireZip(bytes.length === this.size && crc32(bytes) === this.checksum, "The entry failed its ZIP integrity check.");
        if (this.kind === "zip") return parseArchive(bytes);
        const text = decode.decode(bytes);
        return this.kind === "json" ? JSON.parse(text) : text;
    }

    async inflate() {
        requireZip(this.method === 8, "This ZIP compression method is unsupported.");
        const reader = new Blob([this.packed]).stream()
            .pipeThrough(new DecompressionStream("deflate-raw")).getReader();
        const output = new Uint8Array(this.size);
        let offset = 0;
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) return output.subarray(0, offset);
                requireZip(offset + value.length <= output.length, "The entry exceeds its declared size.");
                output.set(value, offset);
                offset += value.length;
            }
        } finally {
            await reader.cancel();
        }
    }
}

export function parseArchive(bytes) {
    requireZip(bytes.length >= 22 && bytes.length <= fileLimit, "Expected a ZIP of at most 16 MiB.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const u16 = offset => view.getUint16(offset, true);
    const u32 = offset => view.getUint32(offset, true);
    let end = bytes.length - 22;
    const earliest = Math.max(0, end - 65535);
    while (end >= earliest && !(u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length)) end--;
    requireZip(end >= earliest, "The ZIP directory footer is missing.");
    const count = u16(end + 10);
    const directorySize = u32(end + 12);
    const directory = u32(end + 16);
    requireZip(u16(end + 4) === 0 && u16(end + 6) === 0 && u16(end + 8) === count &&
        count <= 4096 && directory + directorySize === end, "Unsupported or invalid ZIP directory.");
    const entries = Object.create(null);
    let cursor = directory;
    for (let i = 0; i < count; i++) {
        requireZip(cursor + 46 <= end && u32(cursor) === 0x02014b50, "Invalid ZIP directory record.");
        const flags = u16(cursor + 8);
        const method = u16(cursor + 10);
        const nameLength = u16(cursor + 28);
        const next = cursor + 46 + nameLength + u16(cursor + 30) + u16(cursor + 32);
        const local = u32(cursor + 42);
        requireZip(next <= end && local + 30 <= directory && u32(local) === 0x04034b50 &&
            u16(cursor + 34) === 0 && (flags & 1) === 0, "Invalid or encrypted ZIP entry.");
        const name = decode.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
        const start = local + 30 + u16(local + 26) + u16(local + 28);
        const packedSize = u32(cursor + 20);
        requireZip(name.length > 0 && !/[\x00-\x1f]/.test(name) && start + packedSize <= directory,
            "Invalid ZIP entry name or byte range.");
        if (!name.endsWith("/")) {
            requireZip(!Object.hasOwn(entries, name), "Duplicate ZIP entry names are unsupported.");
            entries[name] = new ArchiveEntry(name, method, bytes.subarray(start, start + packedSize),
                u32(cursor + 24), u32(cursor + 16));
        }
        cursor = next;
    }
    requireZip(cursor === end, "The ZIP directory has unexpected trailing data.");
    return entries;
}
