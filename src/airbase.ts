import { Point } from "./units"

export interface Airbase {
  position: Point;
  friendly: boolean;
}

export class AirbaseImpl implements Airbase {
  position: Point;
  friendly: boolean;

  constructor(position: Point, friendly: boolean) {
    this.position = position;
    this.friendly = friendly;
  }

  update(position: Point) {
    this.position = position;
    return this;
  }
}