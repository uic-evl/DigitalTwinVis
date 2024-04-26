import React, { useEffect, useState, useRef} from 'react';
import * as constants from "../modules/Constants.js"
import * as d3 from 'd3';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

import useSVGCanvas from './useSVGCanvas.js';

export default function SymptomViewD3(props){
    const container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(container);

    useEffect(function draw(){
        if(!svg || !props.data || (height <= 0) || width <= 0){ return;}
        //draw d3 stuff here
        //svg should give you the canvas selection to work with
        //height, width are the dimentions of the canvas
        console.log("container d3",height,width,props.pId,props.data);
    },[svg,height,width,props.data])

    return (
        <div ref={container} className={'col symptomD3'}>{props.pId}</div>
    )
}