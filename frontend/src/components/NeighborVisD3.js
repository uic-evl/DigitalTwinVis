import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";


const margin = [[20,0],[20,0]];


export function NeighborVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    

    const ordinalVars = constants.ordinalVars;
    const booleanVars = constants.booleanVars;
    const continuousVars = constants.continuousVars;

    const colorVar = 'similarity';

    const margin = 10;

    //actually rectangle vars
    const baselineVars = Object.keys(ordinalVars)
        .concat(continuousVars)
        .concat(booleanVars.filter(d=> !d.includes('subsite')));
    
    const outcomes = constants.OUTCOMES.map(i=>i);

    const allVars = props.version === 'baseline'?  baselineVars: outcomes;

    function encodeOrdinal(p,key,values,scale=false){
        let val = values[0];
        let isMissing=true;
        for(let i of values){
            if(p[key+'_'+i] > 0){
                val = i;
                isMissing = false;
                break;
            }
        }
        return val
    }

    function encodePatient(p){
        if(p === undefined){
            return undefined;
        }
        let values = {
            'similarity': p['similarity'],
            'decision': p['decision'],
        }
        for(const [key,v] of Object.entries(ordinalVars)){
            values[key] = encodeOrdinal(p,key,v);
        }
        for(let key of continuousVars){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        for(let key of booleanVars){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        for(let key of constants.DECISIONS){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        for(let key of constants.OUTCOMES){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        return values;
    }

    function radToCartesian(r,t){
        const x = width/2 + r*Math.cos(t);
        const y = height/2 + r*Math.sin(t);
        return [x,y];
    };

    useEffect(()=>{
        if(svg !== undefined & props.data !== undefined){
            var data = encodePatient(props.data);
            var refData = encodePatient(props.referenceData);
            const nVars = allVars.length;

            const thetaScale = d3.scaleLinear()
                .domain([0,nVars])
                .range([0,2*Math.PI]);

            const rScale = d3.scaleLinear()
                .domain([0,1])
                .range([5,width/2 - margin]);

            var pathPoints = [];
            var refPoints = [];
            var outlinePoints = [];
            var plotData = []

            function scaleVal(key,val){
                let minval =0;
                let maxval = 1;
                if(continuousVars.indexOf(key) >= 0){
                    [minval, maxval] = props.valRanges[key];
                } else if(ordinalVars[key] !== undefined){
                    let ranges = ordinalVars[key];
                    minval = ranges[0];
                    maxval = ranges[ranges.length-1];
                }
                let sVal = (val - minval)/(maxval - minval);
                return sVal
            }
            for(let i in allVars){
                let key = allVars[i];
                let val = data[key];
                let trueVal = val;
                let scaledVal = scaleVal(key,val);
                let theta = thetaScale(i);
                let radius = rScale(scaledVal);
                let [x,y] = radToCartesian(radius,theta);

                let entry = {
                    'name': key,
                    'value': val,
                    'trueValue': trueVal,
                    'scaledVal': scaledVal,
                    'x': x,
                    'y': y,
                }
                pathPoints.push([x,y]);
                outlinePoints.push(radToCartesian(rScale(1),theta))
                plotData.push(entry);
                if(refData !== undefined){
                    let rVal = refData[key];
                    let trueVal = rVal;
                    let rScaled = scaleVal(key,rVal);
                    let [rx,ry] = radToCartesian(rScale(rScaled),theta);
                    refPoints.push([rx,ry])
                }
                
            }

            pathPoints.push(pathPoints[0]);
            outlinePoints.push(outlinePoints[0])
            if(props.version === 'baseline'){
                console.log('nVis',data.similarity,d3.interpolateGreys(data.similarity));
            }

            const pathData = [
                {
                    'path': pathPoints,
                    'fill': d3.interpolateGreys(data.similarity**.3),
                    'stroke': 'black',
                    'sw':3,
                },
                {
                    'path': outlinePoints,
                    'fill':'none',
                    'stroke': 'grey',
                    'sw': 1,
                },
            ];
            if(refData !== undefined){
                pathData.push({
                    'path': refPoints,
                    'fill': 'none',
                    'stroke': 'blue',
                    'sw': 3,
                })
            }

            var kPath = svg.selectAll('.kiviatPath').data(pathData)
            kPath.enter()
                .append('path').attr('class','kiviatPath')
                .merge(kPath)
                .attr('d',d=>d3.line()(d.path))
                .attr('stroke',d=>d.stroke).attr('stroke-width',d=>d.sw)
                .attr('fill',d=>d.fill);
            
        }
    },[svg,props.data]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}
