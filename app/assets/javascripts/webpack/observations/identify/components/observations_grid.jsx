import React, { PropTypes } from "react";
import { Row, Col } from "react-bootstrap";
import ObservationsGridItem from "./observations_grid_item";
import Observation from "../models/observation";

const ObservationsGrid = ( {
  observations,
  onObservationClick
} ) => (
  <Row>
    {observations.map( ( observation ) => (
      <Col xs={3} key={observation.id}>
        <ObservationsGridItem
          observation={observation}
          onObservationClick={onObservationClick}
        />
      </Col>
    ) ) };
  </Row>
);

Col.propTypes = {
  key: PropTypes.number
};
ObservationsGrid.propTypes = {
  // observations: PropTypes.array.isRequired,
  observations: PropTypes.arrayOf(
    React.PropTypes.instanceOf( Observation )
  ).isRequired,
  onObservationClick: PropTypes.func
  // onModalClose: PropTypes.func
};

export default ObservationsGrid;
