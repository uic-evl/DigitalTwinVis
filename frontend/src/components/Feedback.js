import React, {useState} from 'react';
import { Button, Modal, ModalOverlay, ModalContent,ModalHeader,ModalBody,ModalCloseButton,useDisclosure, Link} from '@chakra-ui/react';
import { FaArrowRight } from "react-icons/fa6";export default function Feedback(props){

  const { isOpen, onOpen, onClose } = useDisclosure()

  return (
    <div  style={props.style} className={"tutorial"} >
      <Button onClick={onOpen} className={'modalButton'}>Feedback</Button>
      <Modal isOpen={isOpen}  onClose={onClose}>
        <ModalOverlay />
        <ModalContent height="fit-content" minW="min(80vw, 80em)" maxH="90%" >
        <ModalHeader className={'centerText'}>{'Give Feedback or Report a Bug'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody >
            <div style={{'display':'flex','justify-content':'space-around'}}>
              <Link href='https://forms.gle/NMkub3KGUA49Y3w2A' isExternal>
                <Button variant='outline' colorScheme='black' size='lg' rightIcon={<FaArrowRight /> }>
                {'Report A Bug'}
                </Button>
              </Link>
              <Link href='https://forms.gle/T5L8yriGutx2B2FV7' isExternal>
                <Button variant='outline' colorScheme='black' size='lg'rightIcon={<FaArrowRight />}>
                {'Feedback Form'}
                </Button>
              </Link>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  )
}