import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
    auth: {
        clientId: process.env.REACT_APP_AD_APP_ID,
        authority: `https://login.microsoftonline.com/${process.env.REACT_APP_AD_TENANT_ID}`,
        redirectUri: process.env.REACT_APP_REDIRECT_URL,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    },
};

// create PublicClientApplication instance
export const publicClientApplication = new PublicClientApplication(msalConfig);
export const userScopes = ["openid", "profile", "User.Read", "Files.ReadWrite.All"]

