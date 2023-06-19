import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { PublicClientApplication, EventType, EventMessage, PopupRequest, AuthenticationResult, AccountInfo } from "@azure/msal-browser";

interface IAuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<{
  msalInstance: PublicClientApplication;
  account: AccountInfo | null;
  error: string;
  inProgress: boolean;
  login: () => void;
  authToken: string;
} | null>(null);

const msalConfig = {
    auth: {
        clientId: process.env.REACT_APP_AD_APP_ID,
        authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AD_TENANT_ID}`,
        redirectUri: process.env.REACT_APP_REDIRECT_URL,
    },
    cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: false,
    },
};

const loginRequest: PopupRequest = {
  scopes: ["openid", "profile", "User.Read", "Files.ReadWrite.All"]
};

export const AuthProvider: React.FC<IAuthProviderProps> = ({ children }) => {
  const [msalInstance] = useState(new PublicClientApplication(msalConfig));
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [authToken, setAuthToken] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [inProgress, setInProgress] = useState<boolean>(false);

  const login = async () => {
    setInProgress(true);
    setError("");
    try {
      const response: AuthenticationResult = await msalInstance.loginPopup(loginRequest);
      setAccount(msalInstance.getAccountByUsername(response.account.username));
      setAuthToken(response.accessToken);
      console.log("AUTH TOKEN:", response.accessToken)
      setInProgress(false);
    } catch (err) {
      setError(err.message);
      setInProgress(false);
    }
  };

  useEffect(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      setAccount(accounts[0]);
    }
  }, [msalInstance]);

  return (
    <AuthContext.Provider value={{ msalInstance, account, error, inProgress, login, authToken }}>
      {children}
    </AuthContext.Provider>
  );
};




