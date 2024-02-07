import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import SymptomVisD3 from './SymptomVisD3.js';



export default function Symptoms(props){

    const symptomsToPlot = ['drymouth','choke'];
    
    const [plots,setPlots] = useState(<></>);

    useEffect(()=>{
        if(props.symptoms !== undefined){
            
            const symptomData = props.symptoms.symptoms;
            const sIds = props.symptoms.ids;
            const sDists = props.symptoms.dists;
            const dates = props.symptoms.dates;
            const sList = Object.keys(symptomData);
            console.log('sdfsd',props.symptoms);
            const newPlots = sList.map((sName,i)=>{
                i = parseInt(i);
                const sData = symptomData[sName]
                return (<div key={'symptoms'+sName+i} style={{'height': '10em','width': '95%','margin': '.1em','marginTop':'1em'}}>
                    <SymptomVisD3
                        name={sName}
                        data={sData}
                        ids= {sIds}
                        dates={dates}
                        distance={sDists}
                    ></SymptomVisD3>
                    </div>
                    )
            });
            setPlots(newPlots)
        }
    },[props.symptoms])
    return (
        <div
            style={{'height':'95%','width':'95%'}}
            className={'scroll'}
        >
            {plots}
        </div>
    );
}
