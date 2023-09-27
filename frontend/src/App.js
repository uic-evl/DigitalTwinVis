import React from 'react';
import MainApp from './MainApp';
import LoginPage from './Login';
import * as constants from "./modules/Constants.js";
import {useState, useEffect} from 'react';
import axios from 'axios';

import {QueryClient, QueryClientProvider} from 'react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

async function loginUser(username,password) {

  try {
    const response = await axios({
      method:'get',
      url: constants.API_URL + 'login',
      params: {username: username, password: password},
    })
    console.log('login resposne for',username,password,response)
    return {error: false, payload: response.data, message: null}
  } catch (error) {
    console.log('login error',error);
    if (error.response.status === 401) {
      return {error: true, payload: null, message: 'Please, re-authenticate'}
    }
    return {error: true, payload: null, message: error.message};
  }
}

function App(){

  const [authToken,setAuthToken] = useState(false);
  const [authenticated, setAuthenticated] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const login = async (username, password) => {
    const response = await loginUser(username, password);
    if(!response.error & response.payload !== null){
      setAuthToken(response.payload.access_token);
      setAuthenticated(true);
    } else{
      setAuthMessage(response.message);
    }
  }

  function Renderer({authToken,authenticated,login,message}){
    if(authenticated & authToken !== undefined){
      return (<MainApp authToken={authToken}/>)
    } else{
      return (<LoginPage login={login} message={message}/>)
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Renderer authToken={authToken} authenticated={authenticated} login={login} message={authMessage}/>
    </QueryClientProvider>
  )
} 


export default App;