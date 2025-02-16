export interface IUser {
  id: string;
  email?: string;
  created_at?: string;
}

export interface IAuthResponse {
  user: IUser | null;
  session: {
    access_token: string;
    expires_at?: number;
    refresh_token?: string;
  } | null;
  error: {
    message: string;
    status?: number;
  } | null;
}
export interface IRegisterRequest {
  email: string;
  password: string;
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IUserProfileRequest {
  token: string;
}
