export function nm_to_px(nm: number) {
  return nm * 5;
}

export function px_to_nm(px: number) {
  return px / 5;
}

export function degrees_to_radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function radians_to_degrees(radians: number) {
  return (radians * 180) / Math.PI;
}

export class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static fromPoint(point: Point) {
    return new this(point.x, point.y);
  }

  translate(point: Point) {
    return new Point(this.x + point.x, this.y + point.y);
  }

  fromHeading(heading: number, distance_nm: number) {
    let angle = degrees_to_radians(heading - 90);
    let distance = nm_to_px(distance_nm);
    return this.translate(
      new Point(Math.cos(angle) * distance, Math.sin(angle) * distance)
    );
  }

  headingTo(other: Point) {
    let xdist = other.x - this.x;
    let ydist = other.y - this.y;
    let angle = Math.atan2(ydist, xdist);
    let heading = radians_to_degrees(angle) + 90;
    return heading;
  }

  distanceTo(other: Point) {
    let xdist = other.x - this.x;
    let ydist = other.y - this.y;
    return Math.sqrt(Math.pow(xdist, 2) + Math.pow(ydist, 2));
  }
}
