export async function fileTypeFromBuffer(buffer: Buffer): Promise<{ mime: string; ext: string } | undefined> {
  if (!buffer || buffer.length === 0) return undefined;
  const header = buffer.subarray(0, 8).toString('hex').toLowerCase();

  // PDF: %PDF
  if (header.startsWith('25504446')) return { mime: 'application/pdf', ext: 'pdf' };
  // PNG: ‰PNG
  if (header.startsWith('89504e47')) return { mime: 'image/png', ext: 'png' };
  // JPEG
  if (header.startsWith('ffd8ffe0') || header.startsWith('ffd8ffe1') || header.startsWith('ffd8ffe2')) return { mime: 'image/jpeg', ext: 'jpg' };
  // ELF
  if (header.startsWith('7f454c46')) return { mime: 'application/x-elf', ext: 'elf' };
  // ZIP (for OOXML)
  if (header.startsWith('504b0304')) return { mime: 'application/zip', ext: 'zip' };

  return undefined;
}