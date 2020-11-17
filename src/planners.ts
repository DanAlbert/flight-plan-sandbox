import { Point, px_to_nm, radians_to_degrees } from "./units";
import { Airbase } from "./airbase";

export interface FlightPlanProps {
  waypoints: Point[];
}

export class FlightPlan implements FlightPlanProps {
  readonly waypoints: Point[];

  constructor(waypoints: Point[]) {
    this.waypoints = waypoints;
  }
}

export interface FlightPlanner {
  name(): string;
  strike(from: Airbase, to: Airbase): FlightPlan;
}

// The planning algorithm in DCS Liberation 2.2.0.
export class FlightPlanner220 implements FlightPlanner {
  name() {
    return "2.2.0";
  }

  strike(from: Airbase, to: Airbase) {
    const origin = from.position;
    const target = to.position;
    const airfieldHeading = target.headingTo(origin);
    const ingress = target.fromHeading(airfieldHeading + 25, 25);
    const join = ingress.fromHeading(ingress.headingTo(origin), 20);
    const egress = target.fromHeading(airfieldHeading - 25, 25);

    // Takeoff
    let waypoints = [origin];

    // Assume runway heading of 120
    waypoints.push(origin.fromHeading(120, 5));

    // Hold
    waypoints.push(origin.fromHeading(origin.headingTo(target), 15));

    // Join
    waypoints.push(join);

    // Ingress
    waypoints.push(ingress);

    // Target
    waypoints.push(target);

    // Egress
    waypoints.push(egress);

    // Split
    waypoints.push(egress.fromHeading(egress.headingTo(origin), 20));

    // Descent
    waypoints.push(origin.fromHeading(120 + 180, 5));

    // Landing
    waypoints.push(origin);
    return new FlightPlan(waypoints);
  }
}

// The planning algorithm in DCS Liberation 2.2.x
export class FlightPlanner22XRev1 implements FlightPlanner {
  name() {
    return "2.2.x rev 1";
  }

  readonly holdDistance: number = 15;
  readonly pushDistance: number = 20;
  readonly joinDistance: number = 20;
  readonly ingressDistance: number = 45;

  joinShouldRetreat(origin: Point, target: Point, ingress: Point) {
    return px_to_nm(origin.distanceTo(ingress)) < this.joinDistance;
  }

  joinPoint(origin: Point, target: Point, ingress: Point) {
    if (this.joinShouldRetreat(origin, target, ingress)) {
      // If the ingress point is close to the origin, plan the join point
      // farther back.
      return ingress.fromHeading(target.headingTo(origin), this.joinDistance);
    } else {
      return ingress.fromHeading(ingress.headingTo(origin), this.joinDistance);
    }
  }

  holdPoint(origin: Point, target: Point, join: Point) {
    if (origin.distanceTo(target) < join.distanceTo(target)) {
      // If the origin airfield is closer to the target than the join point,
      // plan the hold point such that it retreats from the origin airfield.
      return join.fromHeading(target.headingTo(origin), this.pushDistance);
    }
    let originJoinDistance = px_to_nm(origin.distanceTo(join));
    let hold = origin.fromHeading(origin.headingTo(join), this.holdDistance);
    if (px_to_nm(hold.distanceTo(join)) < this.pushDistance) {
      let headingToJoin = origin.headingTo(join);
      let thetaRad = Math.acos(
        (Math.pow(this.holdDistance, 2) +
          Math.pow(originJoinDistance, 2) -
          Math.pow(this.joinDistance, 2)) /
          (2 * this.holdDistance * originJoinDistance)
      );
      let theta = radians_to_degrees(thetaRad);
      if (isNaN(theta)) {
        // No solution that maintains hold and join distances. Extend the hold
        // point away from the target.
        hold = origin.fromHeading(target.headingTo(origin), this.holdDistance);
      } else {
        hold = origin.fromHeading(headingToJoin - theta, this.holdDistance);
      }
    }
    return hold;
  }

  strike(from: Airbase, to: Airbase) {
    const origin = from.position;
    const target = to.position;
    const airfieldHeading = target.headingTo(origin);
    const ingress = target.fromHeading(
      airfieldHeading + 25,
      this.ingressDistance
    );
    const join = this.joinPoint(origin, target, ingress);
    const egress = target.fromHeading(
      airfieldHeading - 25,
      this.ingressDistance
    );

    // Takeoff
    let waypoints = [origin];

    // Hold
    waypoints.push(this.holdPoint(origin, target, join));

    // Join
    waypoints.push(join);

    // Ingress
    waypoints.push(ingress);

    // Target
    waypoints.push(target);

    // Egress
    waypoints.push(egress);

    // Split
    waypoints.push(this.joinPoint(origin, target, egress));

    // Landing
    waypoints.push(origin);
    return new FlightPlan(waypoints);
  }
}

export class FlightPlanner22XRev2 extends FlightPlanner22XRev1 {
  name() {
    return "2.2.x rev 2";
  }

  joinShouldRetreat(origin: Point, target: Point, ingress: Point) {
    return origin.distanceTo(target) < ingress.distanceTo(target);
  }
}
