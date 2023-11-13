import React from 'react';
import MainApp from './MainApp';
import LoginPage from './Login';
import * as constants from "./modules/Constants.js";
import {useState, useEffect} from 'react';
import axios from 'axios';


//log into the flask api and get an authentication token used to query the tdata in the app
async function loginUser(username,password) {

  try {
    const response = await axios({
      method:'get',
      url: constants.API_URL + 'login',
      params: {username: username, password: password},
    })
    console.log('login response for',username,response);
    return {error: false, payload: response.data, message: null}
  } catch (error) {
    console.log('login error',error);
    if (error.response.status === 401) {
      return {error: true, payload: null, message: 'Username or password is incorrect. The cleaners have been dispatched to your location.'}
    }
    return {error: true, payload: null, message: error.message};
  }
}

function App(){

  const [authToken,setAuthToken] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  //pased to login page to log in
  const login = async (username, password) => {
    const response = await loginUser(username, password);
    if(!response.error & response.payload !== null){
      setAuthToken(response.payload.access_token);
      setAuthenticated(true);
    } else{
      setAuthMessage(response.message);
    }
  }

  useEffect(()=>{
    if(authToken){
      localStorage.setItem('token',authToken);
    }
  },[authToken])

  //if we have a real authentication token continue to the main app
  function Renderer({authToken,authenticated,login,message}){
    if(authToken){
      return (<MainApp authToken={authToken} setAuthToken={setAuthToken}/>)
    } else{
      return (<LoginPage login={login} message={message}/>)
    }
  }

  return (
      <Renderer authToken={authToken} authenticated={authenticated} login={login} message={authMessage}/>
  )
} 


export default App;