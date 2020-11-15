import React from "react";
import Draggable from "react-draggable";
import { Line } from "react-lineto";
import "./App.css";

function nm_to_px(nm: number) {
  return nm * 5;
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
    let angle = ((heading - 90) * Math.PI) / 180;
    let distance = nm_to_px(distance_nm);
    return this.translate(
      new Point(Math.cos(angle) * distance, Math.sin(angle) * distance)
    );
  }

  headingTo(other: Point) {
    let xdist = other.x - this.x;
    let ydist = other.y - this.y;
    let angle = Math.atan2(ydist, xdist);
    let heading = angle * (180 / Math.PI) + 90;
    return heading;
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
          <Line
            x0={previous.x}
            y0={previous.y}
            x1={waypoint.x}
            y1={waypoint.y}
            borderColor="#000"
          />
        );
      });
  }
}

class FlightPlan implements FlightPlanProps {
  waypoints: Point[];

  constructor(waypoints: Point[]) {
    this.waypoints = waypoints;
  }

  static strike(from: Airbase, to: Airbase) {
    // Takeoff
    let waypoints = [from.position];

    // Assume runway heading of 120
    waypoints.push(from.position.fromHeading(120, 5));

    // Hold
    waypoints.push(
      from.position.fromHeading(from.position.headingTo(to.position), 15)
    );

    const airfieldHeading = to.position.headingTo(from.position);
    const ingress = to.position.fromHeading(airfieldHeading + 25, 25);
    const egress = to.position.fromHeading(airfieldHeading - 25, 25);

    // Join
    waypoints.push(ingress.fromHeading(ingress.headingTo(from.position), 20));

    // Ingress
    waypoints.push(ingress);

    // Target
    waypoints.push(to.position);

    // Egress
    waypoints.push(egress);

    // Split
    waypoints.push(egress.fromHeading(egress.headingTo(from.position), 20));

    // Descent
    waypoints.push(from.position.fromHeading(120 + 180, 5));

    // Landing
    waypoints.push(from.position);
    return new this(waypoints);
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

interface AppState {
  anapa: AirbaseImpl;
  mozdok: AirbaseImpl;
  nalchik: AirbaseImpl;
}

class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      anapa: new AirbaseImpl(new Point(nm_to_px(20), nm_to_px(20)), true),
      mozdok: new AirbaseImpl(new Point(nm_to_px(120), nm_to_px(120)), false),
      nalchik: new AirbaseImpl(new Point(nm_to_px(120), nm_to_px(20)), false),
    };
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
            {...FlightPlan.strike(this.state.anapa, this.state.mozdok)}
          />
        </Map>
      </div>
    );
  }
}

export default App;
