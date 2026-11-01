export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user: User;
}

export interface UserLoginInput {
  email: string;
  password: string;
}

export interface UserRegisterInput {
  email: string;
  password: string;
  full_name?: string | null | undefined;
}

export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
}
