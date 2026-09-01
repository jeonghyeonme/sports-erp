export interface AccessTokenPayload {
  sub: string; // accountId
}

export interface RefreshTokenPayload {
  sub: string; // accountId
  jti: string; // RefreshToken row id
}
