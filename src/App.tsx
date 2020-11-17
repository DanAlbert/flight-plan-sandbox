import React from "react";
import Draggable from "react-draggable";
import { Line } from "react-lineto";
import "./App.css";
import { Airbase, AirbaseImpl } from "./airbase";
import { Point, nm_to_px } from "./units";
import {
  FlightPlanProps,
  FlightPlanner,
  FlightPlanner220,
  FlightPlanner22X,
} from "./planners";

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
    this.planners = [new FlightPlanner220(), new FlightPlanner22X()];

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
