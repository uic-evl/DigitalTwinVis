import {useState} from 'react';
import {Input, Button, Flex, FormControl, FormLabel,Text} from '@chakra-ui/react';
import './App.css';


const LoginPage = ({login, message}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  
  const handleOnClick = async () => {
    login(username, password);
  }

  return (
    <Flex align="center" justifyContent="center" minH="100vh">
      <form>
        <FormControl>
          <FormLabel className='centerText'>Username</FormLabel>
          <Input value={username} onChange={e => setUsername(e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel className='centerText'>Password</FormLabel>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </FormControl>
        <Button
          variant={'solid'}
          colorScheme={'blue'}
          onClick={handleOnClick}
        >
          {'Log in'}
        </Button>
        <Text maxWidth="300px" color='darkred' fontWeight={'bold'} flexWrap={'wrap'}>{message}</Text>
      </form>
    </Flex>
  )
}

export default LoginPage