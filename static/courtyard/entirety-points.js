export function convertPoints(text) {
    if (text.length > 1048576) throw new Error("Input exceeds the 1 MiB text limit.");
    const lines = text.split(/\r?\n/);
    const coordinates = [];
    for (const [index, line] of lines.entries()) {
        if (!line.trim()) continue;
        let feature;
        try {
            feature = JSON.parse(line);
        } catch {
            throw new Error(`Line ${index + 1}: invalid JSON.`);
        }
        const point = feature?.geometry?.coordinates;
        if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" ||
            !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) ||
            Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90 ||
            (feature.properties?.name != null && feature.properties.name !== "")) {
            throw new Error(`Line ${index + 1}: expected an unnamed Point with longitude and latitude in range.`);
        }
        coordinates.push(point);
        if (coordinates.length > 5000) throw new Error("The preview accepts up to 5,000 points.");
    }
    if (!coordinates.length) throw new Error("Enter at least one GeoJSON Point feature.");
    const points = new ArrayBuffer(coordinates.length * 16);
    const attributes = new ArrayBuffer(coordinates.length * 24);
    const view = new DataView(points);
    coordinates.forEach(([longitude, latitude], i) => {
        view.setFloat64(i * 16, latitude * 60, true);
        view.setFloat64(i * 16 + 8, longitude * -60, true);
    });
    return { points, attributes, count: coordinates.length };
}
