const env = require('../config/env');
const AppError = require('../utils/AppError');

const isValidCoordinateNumber = (value) => Number.isFinite(value);

const isValidGeolocation = (geolocation) => {
  if (!geolocation) {
    return false;
  }

  const { latitude, longitude } = geolocation;

  return (
    isValidCoordinateNumber(latitude) &&
    isValidCoordinateNumber(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const extractGeolocationFromPayload = (payload = {}) => {
  const latitude = payload?.geolocation?.latitude ?? payload?.latitude;
  const longitude = payload?.geolocation?.longitude ?? payload?.longitude;

  if (latitude === undefined && longitude === undefined) {
    return null;
  }

  if (latitude === undefined || longitude === undefined) {
    throw new AppError(
      400,
      'INVALID_GEOLOCATION',
      'Both latitude and longitude are required when geolocation is provided.'
    );
  }

  const geolocation = {
    latitude: Number(latitude),
    longitude: Number(longitude)
  };

  if (!isValidGeolocation(geolocation)) {
    throw new AppError(
      400,
      'INVALID_GEOLOCATION',
      'Latitude must be between -90 and 90 and longitude between -180 and 180.'
    );
  }

  return geolocation;
};

const geocodeAddress = async ({ address, postalCode }) => {
  if (!env.geoAutoLookup || env.geoProvider !== 'nominatim') {
    return null;
  }

  const query = [address, postalCode].filter(Boolean).join(', ').trim();

  if (!query) {
    return null;
  }

  const url = new URL('/search', env.nominatimBaseUrl);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': env.nominatimUserAgent
      }
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }

    const geolocation = {
      latitude: Number(result[0].lat),
      longitude: Number(result[0].lon)
    };

    return isValidGeolocation(geolocation) ? geolocation : null;
  } catch (error) {
    return null;
  }
};

const resolveFamilyGeolocation = async ({ payload, address, postalCode }) => {
  const providedGeolocation = extractGeolocationFromPayload(payload);

  if (providedGeolocation) {
    return {
      geolocation: providedGeolocation,
      status: 'provided'
    };
  }

  if (!env.geoAutoLookup) {
    return {
      geolocation: null,
      status: 'not_available'
    };
  }

  const geocoded = await geocodeAddress({ address, postalCode });

  if (!geocoded) {
    return {
      geolocation: null,
      status: 'autolookup_failed'
    };
  }

  return {
    geolocation: geocoded,
    status: 'autolookup_success'
  };
};

const resolveVisiteGeolocation = async ({ payload, famille }) => {
  const providedGeolocation = extractGeolocationFromPayload(payload);

  if (providedGeolocation) {
    return {
      geolocation: providedGeolocation,
      status: 'provided'
    };
  }

  if (famille?.geolocation && isValidGeolocation(famille.geolocation)) {
    return {
      geolocation: famille.geolocation,
      status: 'family_fallback'
    };
  }

  if (!env.geoAutoLookup) {
    return {
      geolocation: null,
      status: 'not_available'
    };
  }

  const geocoded = await geocodeAddress({
    address: famille?.address,
    postalCode: famille?.postalCode
  });

  if (!geocoded) {
    return {
      geolocation: null,
      status: 'autolookup_failed'
    };
  }

  return {
    geolocation: geocoded,
    status: 'autolookup_success'
  };
};

module.exports = {
  isValidGeolocation,
  extractGeolocationFromPayload,
  geocodeAddress,
  resolveFamilyGeolocation,
  resolveVisiteGeolocation
};
