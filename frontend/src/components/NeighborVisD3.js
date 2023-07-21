import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function NeighborVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const margin = [[20,20],[20,20]];

    const ordinalVars = constants.ordinalVars;
    const booleanVars = constants.booleanVars;
    const continuousVars = constants.continuousVars;

    const vargroupSeperation = Math.min(width/10,70);

    const allVars = Object.keys(ordinalVars)
        .concat(continuousVars)
        .concat(booleanVars)
        .concat(constants.DECISIONS)
        .concat(constants.OUTCOMES);
    
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
        let values = {}
        if(p === undefined){
            return undefined;
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
            let val = p[key] === undefined? 0:p[key] > .5;
            values[key] = val;
        }
        for(let key of constants.OUTCOMES){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        return values;
    }

    const yScale = useMemo(()=>{
        return d3.scaleLinear()
            .domain([0,1])
            .range([0, height - margin[1][1] - margin[0][1]]);
    },[height])

    useEffect(()=>{
        if(svg !== undefined & props.data !== undefined){
            var data = encodePatient(props.data);
            var refData = encodePatient(props.referenceData)
            const barWidth = (width - margin[0][0] - margin[1][0] - 2*vargroupSeperation)/(allVars.length);
            var currX = margin[0][0];
            var rectData = [];
            var textData = [];
            for(let key of Object.keys(data)){
                if(key === constants.DECISIONS[0] | key === constants.OUTCOMES[0]){
                    currX += vargroupSeperation;
                }
                let val = data[key];
                let minval = 0;
                let maxval = 1;
                if(continuousVars.indexOf(key) >= 0){
                    [minval, maxval] = props.valRanges[key];
                } else if(ordinalVars[key] !== undefined){
                    let ranges = ordinalVars[key];
                    minval = ranges[0];
                    maxval = ranges[ranges.length-1];
                }
                let scaledVal = (val - minval)/(maxval - minval);
                let entry = {
                    'name': key,
                    'min': minval,
                    'max': maxval,
                    'value': val,
                    'height': yScale(scaledVal),
                    'x': currX,
                    'isRef': false,
                }
                if(refData !== undefined){
                    let refEntry = Object.assign({},entry);
                    refEntry.isRef = true;
                    let rVal = refData[key];
                    let rScaledVal = (rVal - minval)/(maxval - minval);
                    refEntry.value = rVal;
                    refEntry.height = yScale(rScaledVal);
                    rectData.push(refEntry);
                }
                rectData.push(entry);
                currX += barWidth;
            }

            function getFill(d){
                return d.isRef? 'none':'teal';
            }
            function getStroke(d){
                return d.isRef? 'black':'none';
            }
            function getStrokeWidth(d){
                return d.isRef? 6:0;
            }
            function getOpacity(d){
                return d.isRef? 1: .75
            }

            function getWidth(d){
                let name = Utils.getFeatureDisplayName(d.name);
                if(name.length >= 6){
                    return barWidth-4;
                }
                return barWidth*name.length/6;
            }
            svg.selectAll('.valRect').remove();
            svg.selectAll('.valRect')
                .data(rectData).enter()
                .append('rect').attr('class','valRect')
                .attr('x',d=>d.x)
                .attr('y',d=> height - margin[1][1] - d.height)
                .attr('height',d=>d.height)
                .attr('fill',getFill)
                .attr("stroke",getStroke)
                .attr('stroke-width',getStrokeWidth)
                .attr('opacity',getOpacity)
                .attr('width',barWidth-4)
                .attr('fill',getFill);

            svg.selectAll('.d3label').remove();
            svg.selectAll('.d3label')
                .data(rectData).enter()
                .append('text').attr('class','d3label')
                .attr('text-anchor','middle')
                .attr('y',height )
                .attr('textLength',getWidth)
                .attr('lengthAdjust','spacingAndGlyphs')
                .attr('x',d=>d.x+(barWidth*.5))
                .attr('fontSize', 1)
                .text(d=>Utils.getFeatureDisplayName(d.name));
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