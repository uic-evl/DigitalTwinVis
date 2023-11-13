import React, {useState} from 'react';
import { Button, Modal, ModalOverlay, ModalContent,ModalHeader,ModalFooter,ModalBody,ModalCloseButton,useDisclosure} from '@chakra-ui/react';
import { Progress } from '@chakra-ui/react'

export default function Tutorial(props){

  const images = ['/overview.png','topbar_tutorial.png','/input_tutorial.png','recomendation_histogram_tutorial.png','/outcome_tutorial.png','/attribution_tutorial.png'];
  const titles = [
    'Overview of the Model',
    'Top Bar',
    'Inputting Patient Information',
    'Model Recommendation',
    'Predicted Outcomes',
    'Model Recommendation Explanations'
  ]
  const [stage,setStage] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure()

  const incrementStage = (direction)=>{
    let newStage = direction > 0? stage + 1: stage - 1;
    if(newStage < 0 | newStage >= images.length){
      newStage = 0;
    }
    setStage(newStage)
  }

  //event handler for key presses (up/down for incrementing brush event)
  function handleKeyPress(e){
    console.log('e',e)
    e.preventDefault();
    if(e.keyCode === 37){
        incrementStage(-1)
    } else if(e.keyCode === 39){
        incrementStage(1)
    }
}
  const style = props.style||{};
  return (
    <div  style={style} className={"tutorial"} onKeyUp={handleKeyPress}>
      <Button onClick={onOpen} className={'modalButton'}>Help</Button>
      <Modal isOpen={isOpen}  onClose={onClose}>
        <ModalOverlay />
        <ModalContent height="fit-content" minW="min(80vw, 80em)" maxH="90%" >
        <ModalHeader className={'centerText'}>{titles[stage]}</ModalHeader>
          <ModalCloseButton />
          <ModalBody >
            <img style={{'objectFit':'contain'}} src={images[stage]}/>
          </ModalBody>
          <Progress style={{'width':'90%','left':'5%'}} value={100*(stage+.01)/(images.length-.99)}/>
          <ModalFooter display={'flex'} justifyContent={'space-between'}>
            <Button onClick={() => incrementStage(-1)} variant='outline'>Previous</Button>
            <Button onClick={() => incrementStage(1)} variant='outline'>Next</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}