export interface LinkedInMiniProfileLike {
  publicIdentifier?: string;
  entityUrn?: string;
  trackingId?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  occupation?: string;
  picture?: LinkedInPictureLike;
  profilePicture?: LinkedInPictureLike;
}

export interface LinkedInDashProfileLike {
  publicIdentifier?: string;
  entityUrn?: string;
  memberIdentity?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  headline?: string;
  occupation?: string;
  locationName?: string;
  geoLocationName?: string;
  profilePicture?: LinkedInPictureLike;
}

export interface LinkedInPictureLike {
  rootUrl?: string;
  artifacts?: Array<{
    fileIdentifyingUrlPathSegment?: string;
    width?: number;
    height?: number;
  }>;
  displayImageReference?: {
    vectorImage?: LinkedInPictureLike;
  };
}
