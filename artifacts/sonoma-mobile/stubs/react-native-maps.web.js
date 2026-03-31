const React = require("react");
const { View } = require("react-native");

const MapView = (props) => React.createElement(View, { style: props.style });
MapView.Animated = MapView;

const Marker = () => null;
const Callout = () => null;
const Polyline = () => null;
const Polygon = () => null;
const Circle = () => null;
const Overlay = () => null;

module.exports = {
  default: MapView,
  MapView,
  Marker,
  Callout,
  Polyline,
  Polygon,
  Circle,
  Overlay,
  PROVIDER_GOOGLE: "google",
  PROVIDER_DEFAULT: null,
};
