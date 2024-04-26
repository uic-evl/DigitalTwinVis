import React, {useState, useEffect, useRef} from 'react';
import Utils from '../modules/Utils.js';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';
import SymptomViewD3 from './SymptomViewD3.jsx';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';


export default function SymptomView(props){
    const canvasRef = useRef(null);
    const [patientViews,setPatientViews] = useState(<></>);

    const maxNeighbors = 10;

    useEffect(()=>{
        if(!props.symptomData || !props.symptomClusters || !props.selectedPatient){return;}
        console.log('sview',props)

        let pList = [{id: props.selectedPatient, similarity: 1}];
        let clusterData = props.symptomClusters.patients[props.selectedPatient];
        try{
            let neighbors = clusterData.neighbors;
            let sims = clusterData.similarity;
            let count = 0;
            for(let n of neighbors){
                if(count > maxNeighbors){break;}
                let obj = {id: n, similarity: sims[count]}
                pList.push(obj);
                count += 1
            }
        } catch{
            console.log('problem getting neighbors', props.symptomClusters.patients,props.selectedPatient);
        }
        let pViews = pList.map((obj,i)=>{
            let pEntry = props.symptomData.patients[obj.id];
            return(
                <SymptomViewD3
                    pId={obj.id}
                    similarity={obj.similarity}
                    data={pEntry}
                    key={'symptomD3_'+i}
                ></SymptomViewD3>
            )
        });
        setPatientViews(pViews);
    },[props.symptomData,props.symptomClusters,props.selectedPatient]);

    return (
        <div ref={canvasRef} className={"col symptomViewCanvas"}>
            {patientViews}
        </div>
    )
}
