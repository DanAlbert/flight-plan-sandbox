import React from "react";
import Draggable from "react-draggable";
import { Line } from "react-lineto";
import "./App.css";

function nm_to_px(nm: number) {
  return nm * 5;
}

function px_to_nm(px: number) {
  return px / 5;
}

function degrees_to_radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function radians_to_degrees(radians: number) {
  return (radians * 180) / Math.PI;
}

class Point {
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

interface Airbase {
  position: Point;
  friendly: boolean;
}

interface AirbaseDisplayProps extends Airbase {
  updateState: (newPosition: Point) => void;
}

class AirbaseDisplay extends React.Component<AirbaseDisplayProps> {
  handleDrag = (_e: any, ui: { deltaX: number; deltaY: number }) => {
    this.props.updateState(
      this.props.position.translate(new Point(ui.deltaX, ui.deltaY))
    );
  };

  render() {
    return (
      <Draggable position={this.props.position} onDrag={this.handleDrag}>
        <div
          className={`airbase ${
            this.props.friendly ? "friendly-airbase" : "enemy-airbase"
          }`}
        ></div>
      </Draggable>
    );
  }
}

class Map extends React.Component {
  render() {
    return <div className="map">{this.props.children}</div>;
  }
}

interface WaypointDisplayProps {
  position: Point;
}

class WaypointDisplay extends React.Component<WaypointDisplayProps> {
  render() {
    return (
      <div
        className="waypoint"
        style={{ left: this.props.position.x, top: this.props.position.y }}
      ></div>
    );
  }
}

interface FlightPlanProps {
  waypoints: Point[];
}

class FlightPlanDisplay extends React.Component<FlightPlanProps> {
  render() {
    return this.props.waypoints
      .slice(1)
      .map((waypoint: Point, index: number) => {
        let previous = this.props.waypoints[index];
        return (
          <div>
            <WaypointDisplay position={waypoint} />
            <Line
              x0={previous.x}
              y0={previous.y}
              x1={waypoint.x}
              y1={waypoint.y}
              borderColor="#000"
            />
          </div>
        );
      });
  }
}

class FlightPlan implements FlightPlanProps {
  readonly waypoints: Point[];

  constructor(waypoints: Point[]) {
    this.waypoints = waypoints;
  }
}

interface FlightPlanner {
  name(): string;
  strike(from: Airbase, to: Airbase): FlightPlan;
}

// The planning algorithm in DCS Liberation 2.2.0.
class FlightPlanner220 implements FlightPlanner {
  name() {
    return "2.2.0"
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
class FlightPlanner22X implements FlightPlanner {
  name() {
    return "2.2.x"
  }

  readonly holdDistance: number = 15;
  readonly pushDistance: number = 20;
  readonly joinDistance: number = 20;
  readonly ingressDistance: number = 25;

  joinPoint(origin: Point, target: Point, ingress: Point) {
    if (px_to_nm(origin.distanceTo(ingress)) < this.joinDistance) {
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

class AirbaseImpl implements Airbase {
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

interface ComboboxProps {
  label: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

class Combobox extends React.Component<ComboboxProps> {
  render() {
    return (
      <form>
        <label>{this.props.label}</label>
        <select onChange={this.props.onChange}>{this.props.children}</select>
      </form>
    );
  }
}

interface AppState {
  anapa: AirbaseImpl;
  mozdok: AirbaseImpl;
  nalchik: AirbaseImpl;
  flightPlannerIndex: number;
}

class App extends React.Component<{}, AppState> {
  planners: FlightPlanner[];

  constructor(props: {}) {
    super(props);
    this.planners = [
      new FlightPlanner220(),
      new FlightPlanner22X(),
    ];

    this.state = {
      anapa: new AirbaseImpl(new Point(nm_to_px(20), nm_to_px(20)), true),
      mozdok: new AirbaseImpl(new Point(nm_to_px(120), nm_to_px(120)), false),
      nalchik: new AirbaseImpl(new Point(nm_to_px(120), nm_to_px(20)), false),
      flightPlannerIndex: 0,
    };
    this.onPlannerChange = this.onPlannerChange.bind(this);
  }

  onPlannerChange(event: React.ChangeEvent<HTMLSelectElement>) {
    this.setState({
      flightPlannerIndex: event.currentTarget.selectedIndex,
    });
  }

  flightPlanner(): FlightPlanner {
    return this.planners[this.state.flightPlannerIndex];
  }

  render() {
    return (
      <div className="App">
        <Map>
          <AirbaseDisplay
            position={this.state.anapa.position}
            friendly={this.state.anapa.friendly}
            updateState={(newPosition: Point) => {
              this.setState({
                anapa: this.state.anapa.update(newPosition),
              });
            }}
          />
          <AirbaseDisplay
            position={this.state.mozdok.position}
            friendly={this.state.mozdok.friendly}
            updateState={(newPosition: Point) => {
              this.setState({
                mozdok: this.state.mozdok.update(newPosition),
              });
            }}
          />
          <AirbaseDisplay
            position={this.state.nalchik.position}
            friendly={this.state.nalchik.friendly}
            updateState={(newPosition: Point) => {
              this.setState({
                nalchik: this.state.nalchik.update(newPosition),
              });
            }}
          />
          <FlightPlanDisplay
            waypoints={
              this.flightPlanner().strike(this.state.anapa, this.state.mozdok)
                .waypoints
            }
          />
        </Map>
        <Combobox label="Flight planner" onChange={this.onPlannerChange}>
          {this.planners.map((planner: FlightPlanner, index: number) => {
            return (
              <option selected={index == this.state.flightPlannerIndex}>
                {planner.name()}
              </option>
            );
          })}
        </Combobox>
      </div>
    );
  }
}

export default App;
