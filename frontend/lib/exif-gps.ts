export type ImageGpsCoordinates = {
  lat: number;
  lng: number;
};

export async function extractGpsFromImageFile(
  file: File,
): Promise<ImageGpsCoordinates | null> {
  const buffer = await file.arrayBuffer();
  return extractGpsFromArrayBuffer(buffer);
}

function extractGpsFromArrayBuffer(buffer: ArrayBuffer): ImageGpsCoordinates | null {
  const view = new DataView(buffer);

  if (view.byteLength < 4) {
    return null;
  }

  if (view.getUint16(0, false) === 0xffd8) {
    return extractGpsFromJpeg(view);
  }

  const byteOrder = view.getUint16(0, false);
  if (byteOrder === 0x4949 || byteOrder === 0x4d4d) {
    return extractGpsFromTiff(view, 0);
  }

  return null;
}

function extractGpsFromJpeg(view: DataView): ImageGpsCoordinates | null {
  let offset = 2;

  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      break;
    }

    const marker = view.getUint8(offset + 1);
    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2) {
      break;
    }

    if (marker === 0xe1 && hasExifHeader(view, offset + 4)) {
      return extractGpsFromTiff(view, offset + 10);
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function hasExifHeader(view: DataView, offset: number) {
  return (
    getAscii(view, offset, 4) === "Exif" &&
    view.getUint8(offset + 4) === 0x00 &&
    view.getUint8(offset + 5) === 0x00
  );
}

function extractGpsFromTiff(view: DataView, tiffStart: number): ImageGpsCoordinates | null {
  const byteOrder = getAscii(view, tiffStart, 2);
  const littleEndian = byteOrder === "II";

  if (!littleEndian && byteOrder !== "MM") {
    return null;
  }

  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) {
    return null;
  }

  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const rootEntries = readIfdEntries(view, tiffStart, tiffStart + firstIfdOffset, littleEndian);
  const gpsPointer = rootEntries.find((entry) => entry.tag === 0x8825);

  if (!gpsPointer) {
    return null;
  }

  const gpsIfdOffset = tiffStart + gpsPointer.valueOffsetRaw;
  const gpsEntries = readIfdEntries(view, tiffStart, gpsIfdOffset, littleEndian);

  const latitudeRef = readAsciiTag(view, tiffStart, gpsEntries, littleEndian, 0x0001);
  const latitude = readRationalTag(view, tiffStart, gpsEntries, littleEndian, 0x0002);
  const longitudeRef = readAsciiTag(view, tiffStart, gpsEntries, littleEndian, 0x0003);
  const longitude = readRationalTag(view, tiffStart, gpsEntries, littleEndian, 0x0004);

  if (!latitudeRef || !longitudeRef || latitude.length < 3 || longitude.length < 3) {
    return null;
  }

  const lat = toDecimalDegrees(latitude, latitudeRef);
  const lng = toDecimalDegrees(longitude, longitudeRef);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

function readIfdEntries(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean,
) {
  if (ifdOffset + 2 > view.byteLength) {
    return [];
  }

  const entryCount = view.getUint16(ifdOffset, littleEndian);
  const entries: Array<{
    tag: number;
    type: number;
    count: number;
    valueOffsetRaw: number;
    entryOffset: number;
  }> = [];

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) {
      break;
    }

    entries.push({
      tag: view.getUint16(entryOffset, littleEndian),
      type: view.getUint16(entryOffset + 2, littleEndian),
      count: view.getUint32(entryOffset + 4, littleEndian),
      valueOffsetRaw: view.getUint32(entryOffset + 8, littleEndian),
      entryOffset,
    });
  }

  return entries;
}

function readAsciiTag(
  view: DataView,
  tiffStart: number,
  entries: Array<{ tag: number; type: number; count: number; valueOffsetRaw: number; entryOffset: number }>,
  littleEndian: boolean,
  tag: number,
) {
  const entry = entries.find((candidate) => candidate.tag === tag);
  if (!entry) {
    return null;
  }

  const offset = getTagValueOffset(entry, tiffStart);
  return getAscii(view, offset, entry.count).replace(/\0/g, "").trim();
}

function readRationalTag(
  view: DataView,
  tiffStart: number,
  entries: Array<{ tag: number; type: number; count: number; valueOffsetRaw: number; entryOffset: number }>,
  littleEndian: boolean,
  tag: number,
) {
  const entry = entries.find((candidate) => candidate.tag === tag);
  if (!entry) {
    return [];
  }

  const offset = getTagValueOffset(entry, tiffStart);
  const values: number[] = [];

  for (let index = 0; index < entry.count; index += 1) {
    const numeratorOffset = offset + index * 8;
    const denominatorOffset = numeratorOffset + 4;
    if (denominatorOffset + 4 > view.byteLength) {
      break;
    }

    const numerator = view.getUint32(numeratorOffset, littleEndian);
    const denominator = view.getUint32(denominatorOffset, littleEndian);
    values.push(denominator === 0 ? 0 : numerator / denominator);
  }

  return values;
}

function getTagValueOffset(
  entry: { type: number; count: number; valueOffsetRaw: number; entryOffset: number },
  tiffStart: number,
) {
  const size = getTypeSize(entry.type) * entry.count;
  return size <= 4 ? entry.entryOffset + 8 : tiffStart + entry.valueOffsetRaw;
}

function getTypeSize(type: number) {
  switch (type) {
    case 1:
    case 2:
    case 7:
      return 1;
    case 3:
      return 2;
    case 4:
    case 9:
      return 4;
    case 5:
    case 10:
      return 8;
    default:
      return 1;
  }
}

function toDecimalDegrees(values: number[], ref: string) {
  const [degrees = 0, minutes = 0, seconds = 0] = values;
  const sign = ref === "S" || ref === "W" ? -1 : 1;
  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function getAscii(view: DataView, offset: number, length: number) {
  let output = "";

  for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
    output += String.fromCharCode(view.getUint8(offset + index));
  }

  return output;
}
