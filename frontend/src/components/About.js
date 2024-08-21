import React, {useState} from 'react';
import { Button, Modal, ModalOverlay, ModalContent,ModalHeader,ModalFooter,ModalBody,ModalCloseButton,useDisclosure} from '@chakra-ui/react';
import { Progress } from '@chakra-ui/react'

const dataText = (<p>
  The data used to train this model was a cohort of 526 Head and Neck Cancer
  patients treated using definitive radiation therapy at the MD Anderson Cancer Center between 2003 and 2013 and that
  have at least 4 years of follow-up time.
  Data was collected from electronic health record data, and lymph node involvement was gathered manually from CT Scans.
  Feeding Tube and Aspiration indicate patients that were hospitalized 
  for these toxicities within 6 months of radiation treatment ending.
  <br/>
  The paper for this tool can be found 
  <a href="https://doi.org/10.48550/arXiv.2407.13107" target="_blank" style={{color: 'blue'}} > (Here) </a>
  <br/>
  The original paper this system is based off of is described 
  <a href='https://www.jmir.org/2022/4/e29455/' target="_blank" style={{'color':"blue"}}> (Here) </a>
  <br/>
  The data can be found 
  <a 
    style={{'color':"blue"}}
    href='https://figshare.com/projects/Optimal_policy_determination_in_sequential_systemic_and_locoregional_therapy_of_oropharyngeal_squamous_carcinomas_A_patient-physician_digital_twin_dyad_with_deep_Q-learning/92840' target="_blank"> (Here) 
  </a>

  </p>)

const symptomText = (<p>
  Symptom models were trained on a newer cohort of patients using patient-reported values using the 
  <a href="https://www.mdanderson.org/research/departments-labs-institutes/departments-divisions/symptom-research/symptom-assessment-tools/md-anderson-symptom-inventory.html" target="_blank" style={{'color':'blue'}}> MDASI Symptom Inventory. </a>
  Input values for this interface do not consider Lymph node level as this data was not available.
  Ratings are given from the start of radiation treatment on a scale of 0-10. 
  Missing values are imputed as described
  <a href="doi.org/10.1109/ICHI57859.2023.00047" target="_blank" style={{'color':'blue'}}> (Here) </a>
</p>)
export default function About(props){

  const images = ['','']
  const titles = [
    'Data','Symptoms',
  ]

  const texts = [
    dataText,
    symptomText,
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
      <Button onClick={onOpen} className={'modalButton'}>About</Button>
      <Modal isOpen={isOpen}  onClose={onClose}>
        <ModalOverlay />
        <ModalContent height="fit-content" minW="min(80vw, 80em)" maxH="90%" >
        <ModalHeader className={'centerText'}>{titles[stage]}</ModalHeader>
          <ModalCloseButton />
          <ModalBody style={{'margin':'2em'}}>
            {images[stage] !== ''? <img style={{'objectFit':'contain'}} src={images[stage]}/>: <></>}
            <p>{texts[stage]}</p>
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