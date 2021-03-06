import inatjs from "inaturalistjs";
import _ from "lodash";
import { defaultObservationParams } from "../../shared/util";
import { objectToComparable } from "../../../shared/util";
import { setConfig } from "../../../shared/ducks/config";

const SET_OBSERVATION_PHOTOS = "taxa-photos/photos/SET_OBSERVATION_PHOTOS";
const APPEND_OBSERVATION_PHOTOS = "taxa-photos/photos/APPEND_OBSERVATION_PHOTOS";
const SET_OBSERVATION_PARAMS = "taxa-photos/photos/SET_OBSERVATION_PARAMS";
const UPDATE_OBSERVATION_PARAMS = "taxa-photos/photos/UPDATE_OBSERVATION_PARAMS";
const SET_PHOTOS_GROUP = "taxa-photos/photos/SET_PHOTOS_GROUP";
const CLEAR_GROUPED_PHOTOS = "taxa-photos/photos/CLEAR_GROUPED_PHOTOS";

const DEFAULT_PARAMS = {
  layout: "fluid",
  order_by: "votes"
};

const setUrl = ( newParams, defaultParams = DEFAULT_PARAMS ) => {
  // don't put defaults in the URL
  const newState = {};
  _.forEach( newParams, ( v, k ) => {
    if ( !v ) {
      return;
    }
    if ( defaultParams[k] !== undefined && defaultParams[k] === v ) {
      return;
    }
    if ( _.isArray( v ) ) {
      newState[k] = v.join( "," );
    } else {
      newState[k] = v;
    }
  } );
  if ( !newParams.place_id ) {
    newState.place_id = "any";
  }
  // don't set the url if there's been no change
  const urlState = $.deparam( window.location.search.replace( /^\?/, "" ) );
  urlState.place_id = urlState.place_id || "any";
  if ( objectToComparable( urlState ) === objectToComparable( newState ) ) {
    return;
  }
  const title = `${I18n.t( "photos" )}: ${$.param( newState )}`;
  const newUrlState = _.pickBy( newState, ( v, k ) => !( k === "place_id" && v === "any" ) );
  const newUrl = [
    window.location.origin,
    window.location.pathname,
    _.isEmpty( newUrlState ) ? "" : "?",
    _.isEmpty( newUrlState ) ? "" : $.param( newUrlState )
  ].join( "" );
  history.pushState( newState, title, newUrl );
};

const DEFAULT_STATE = {
  observationPhotos: [],
  observationParams: {
    order_by: "votes"
  }
};

export default function reducer( state = DEFAULT_STATE, action ) {
  const newState = Object.assign( { }, state );
  switch ( action.type ) {
    case SET_OBSERVATION_PHOTOS:
      newState.observationPhotos = action.observationPhotos;
      newState.totalResults = action.totalResults;
      newState.page = action.page;
      newState.perPage = action.perPage;
      break;
    case APPEND_OBSERVATION_PHOTOS:
      newState.observationPhotos = _.uniqBy(
        newState.observationPhotos.concat( action.observationPhotos ),
        record => record.photo.id
      );
      newState.totalResults = action.totalResults;
      newState.page = action.page;
      newState.perPage = action.perPage;
      break;
    case UPDATE_OBSERVATION_PARAMS:
      newState.observationParams = Object.assign( { }, state.observationParams,
        action.params );
      _.forEach( newState.observationParams, ( v, k ) => {
        if (
          v === null
          || v === undefined
          || ( typeof ( v ) === "string" && v.length === 0 )
        ) {
          delete newState.observationParams[k];
        }
      } );
      break;
    case SET_OBSERVATION_PARAMS:
      newState.observationParams = Object.assign( { }, action.params );
      _.forEach( newState.observationParams, ( v, k ) => {
        if (
          v === null
          || v === undefined
          || ( typeof ( v ) === "string" && v.length === 0 )
        ) {
          delete newState.observationParams[k];
        }
      } );
      break;
    case SET_PHOTOS_GROUP: {
      newState.groupedPhotos = newState.groupedPhotos || {};
      newState.groupedPhotos[action.groupName] = {
        groupName: action.groupName,
        observationPhotos: action.observationPhotos,
        groupObject: action.groupObject
      };
      break;
    }
    case CLEAR_GROUPED_PHOTOS:
      delete newState.groupedPhotos;
      break;
    default:
      // ok
  }
  return newState;
}

export function setObservationPhotos(
  observationPhotos,
  totalResults,
  page,
  perPage
) {
  return {
    type: SET_OBSERVATION_PHOTOS,
    observationPhotos,
    totalResults,
    page,
    perPage
  };
}

export function appendObservationPhotos(
  observationPhotos,
  totalResults,
  page,
  perPage
) {
  return {
    type: APPEND_OBSERVATION_PHOTOS,
    observationPhotos,
    totalResults,
    page,
    perPage
  };
}

export function setObservationParams( params ) {
  return {
    type: SET_OBSERVATION_PARAMS,
    params
  };
}

export function updateObservationParams( params ) {
  return {
    type: UPDATE_OBSERVATION_PARAMS,
    params
  };
}

export function setPhotosGroup( groupName, observationPhotos, groupObject ) {
  return {
    type: SET_PHOTOS_GROUP,
    groupName,
    observationPhotos,
    groupObject
  };
}

export function clearGroupedPhotos( ) {
  return { type: CLEAR_GROUPED_PHOTOS };
}

function observationPhotosFromObservations( observations ) {
  return _.flatten(
    observations.map(
      observation => observation.photos.map( photo => ( { photo, observation } ) )
    )
  );
}

function onePhotoPerObservation( observationPhotos ) {
  const singleObservationPhotos = [];
  const obsPhotoHash = {};
  for ( let i = 0; i < observationPhotos.length; i += 1 ) {
    const observationPhoto = observationPhotos[i];
    if ( !obsPhotoHash[observationPhoto.observation.id] ) {
      obsPhotoHash[observationPhoto.observation.id] = true;
      singleObservationPhotos.push( observationPhoto );
    }
  }
  return singleObservationPhotos;
}

export function fetchObservationPhotos( options = {} ) {
  return function ( dispatch, getState ) {
    const s = getState( );
    const params = Object.assign(
      { },
      defaultObservationParams( s ),
      s.photos.observationParams,
      {
        page: options.page,
        per_page: options.perPage || 12
      }
    );
    return inatjs.observations.search( params )
      .then( response => {
        let observationPhotos = observationPhotosFromObservations( response.results );
        // For taxa above species, show one photo per observation
        if ( s.taxon.taxon && s.taxon.taxon.rank_level > 10 ) {
          observationPhotos = onePhotoPerObservation( observationPhotos );
        }
        let action = appendObservationPhotos;
        if ( options.reload ) {
          action = setObservationPhotos;
        }
        dispatch( action(
          observationPhotos,
          response.total_results,
          response.page,
          response.per_page
        ) );
      } );
  };
}

export function fetchMorePhotos( ) {
  return function ( dispatch, getState ) {
    const s = getState( );
    const page = s.photos.page + 1;
    const { perPage } = s.photos;
    dispatch( fetchObservationPhotos( { page, perPage } ) );
  };
}

function fetchPhotosGroupedByParam( param, values ) {
  return function ( dispatch, getState ) {
    const s = getState( );
    const limit = 12;
    const baseParams = Object.assign(
      { },
      defaultObservationParams( s ),
      s.photos.observationParams,
      { per_page: limit }
    );
    _.forEach( values, value => {
      let groupName = value;
      let groupObject;
      const params = Object.assign( { }, baseParams );
      if ( param === "taxon_id" ) {
        groupName = value.id;
        groupObject = value;
        params[param] = groupName;
      } else {
        groupName = value.controlled_value.label;
        params.term_id = parseInt( value.controlled_attribute.id, 0 );
        params.term_value_id = parseInt( value.controlled_value.id, 0 );
      }
      dispatch( setPhotosGroup( groupName, [], groupObject ) );
      inatjs.observations.search( params ).then( response => {
        let observationPhotos = observationPhotosFromObservations( response.results );
        if ( observationPhotos.length > limit ) {
          observationPhotos = _.uniqBy( observationPhotos, op => op.observation.id );
        }
        dispatch( setPhotosGroup( groupName, observationPhotos, groupObject ) );
      } );
    } );
  };
}

function setUrlFromState( state ) {
  const urlState = Object.assign( { }, state.photos.observationParams, {
    grouping: state.config.grouping ? state.config.grouping.param : null,
    layout: state.config.layout ? state.config.layout : "fluid",
    place_id: state.config.chosenPlace ? state.config.chosenPlace.id : null
  } );
  setUrl( urlState );
}

export function updateObservationParamsAndUrl( params ) {
  return function ( dispatch, getState ) {
    dispatch( updateObservationParams( params ) );
    setUrlFromState( getState( ) );
  };
}

export function setConfigAndUrl( params ) {
  return function ( dispatch, getState ) {
    dispatch( setConfig( params ) );
    setUrlFromState( getState( ) );
  };
}

export function setGrouping( param, values ) {
  return function ( dispatch, getState ) {
    dispatch( clearGroupedPhotos( ) );
    if ( param ) {
      if ( param === "taxon_id" ) {
        const { taxon } = getState( ).taxon;
        dispatch( setConfigAndUrl( { grouping: { param, values } } ) );
        dispatch( fetchPhotosGroupedByParam( "taxon_id", taxon.children ) );
      } else {
        const { fieldValues } = getState( ).taxon;
        if ( fieldValues && fieldValues[values] ) {
          // when grouping by a term, remove existing term filters
          dispatch( updateObservationParamsAndUrl( { term_id: null, term_value_id: null } ) );
          dispatch( setConfigAndUrl( { grouping: { param, values } } ) );
          dispatch( fetchPhotosGroupedByParam( param, fieldValues[values] ) );
        } else {
          dispatch( setConfigAndUrl( { grouping: { } } ) );
          dispatch( fetchObservationPhotos( { reload: true } ) );
        }
      }
    } else {
      dispatch( setConfigAndUrl( { grouping: { } } ) );
      dispatch( fetchObservationPhotos( { reload: true } ) );
    }
  };
}

export function reloadPhotos( ) {
  return function ( dispatch, getState ) {
    const state = getState( );
    if ( state.config.grouping ) {
      dispatch( setGrouping( state.config.grouping.param, state.config.grouping.values ) );
    } else {
      dispatch( fetchObservationPhotos( { reload: true } ) );
    }
  };
}

// Sets state from URL params. Should not itself alter the URL.
export function hydrateFromUrlParams( params ) {
  return function ( dispatch ) {
    if ( !params ) {
      params = {};
    }
    if ( params.grouping ) {
      const match = params.grouping.match( /terms:([0-9]+)$/ );
      if ( match ) {
        dispatch(
          setConfig( { grouping: { param: params.grouping, values: Number( match[1] ) } } )
        );
      } else {
        dispatch( setConfig( { grouping: { param: params.grouping } } ) );
      }
    } else {
      dispatch( setConfig( { grouping: { param: DEFAULT_PARAMS.grouping } } ) );
    }
    if ( params.layout ) {
      dispatch( setConfig( { layout: params.layout } ) );
    } else {
      dispatch( setConfig( { layout: DEFAULT_PARAMS.layout } ) );
    }
    if ( params.place_id ) {
      if ( params.place_id === "any" ) {
        dispatch( setConfig( { chosenPlace: null } ) );
      } else {
        inatjs.places.fetch( params.place_id ).then(
          response => {
            dispatch( setConfig( { chosenPlace: response.results[0] } ) );
          },
          error => {
            console.log( "[DEBUG] error: ", error );
          }
        );
      }
    }
    const newObservationParams = Object.assign( { }, DEFAULT_STATE.observationParams );
    if ( params.order_by ) {
      newObservationParams.order_by = params.order_by;
    }
    if ( params.photo_license ) {
      newObservationParams.photo_license = params.photo_license;
    }
    if ( params.quality_grade ) {
      newObservationParams.quality_grade = params.quality_grade;
    }
    _.forEach( params, ( value, key ) => {
      if ( !key.match( /^term(_value)?_id$/ ) ) {
        return;
      }
      newObservationParams[key] = value;
    } );
    if ( !_.isEmpty( newObservationParams ) ) {
      dispatch( setObservationParams( newObservationParams ) );
    }
  };
}
