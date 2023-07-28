import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function NeighborVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const margin = [[20,0],[20,0]];

    const ordinalVars = constants.ordinalVars;
    const booleanVars = constants.booleanVars;
    const continuousVars = constants.continuousVars;

    const vargroupSeperation = Math.min(width/20,10);

    const allVars = Object.keys(ordinalVars)
        .concat(continuousVars)
        .concat(booleanVars.filter(d=> !d.includes('subsite')));
    
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
            var refData = encodePatient(props.referenceData);
            const hasRef = refData !== undefined;
            const barWidth = (width - margin[0][0] - margin[1][0] - vargroupSeperation)/(allVars.length + constants.OUTCOMES.length);
            var currX = margin[0][0];

            function getData(key,useRef){
                if(key === constants.DECISIONS[0] | key === constants.OUTCOMES[0]){
                    currX += vargroupSeperation;
                }
                let val = data[key];
                let trueVal = val;
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
                if(hasRef & useRef){
                    let rVal = refData[key];
                    rVal = (rVal - minval)/(maxval - minval);
                    scaledVal = scaledVal - rVal;
                }
                let entry = {
                    'name': key,
                    'min': minval,
                    'max': maxval,
                    'value': val,
                    'trueValue': trueVal,
                    'scaledVal': scaledVal,
                    'height': Math.min(barWidth,height),//yScale(scaledVal),
                    'x': currX,
                    'isRelative': useRef,
                }
                currX += barWidth
                return entry;
            }

            let rectData = allVars.map(d=>getData(d,hasRef));
            currX  += vargroupSeperation
            let outcomeData = constants.OUTCOMES.map(d=>getData(d,false));


            var colorScale = d3.interpolateGreys;
            var refColorScale = d3.scaleDiverging()
                    .domain([-1,0,1])
                    .range(['green','white','blue'])
        

            function getFill(d){
                if(d.isRelative){
                    return refColorScale(d.scaledVal);
                }
                return colorScale(d.scaledVal);
            }

            function getWidth(d){
                let name = Utils.getFeatureDisplayName(d.name);
                if(name.length >= 6){
                    return barWidth-4;
                }
                return barWidth*name.length/6;
            }

            const centerY = height/2;
            svg.selectAll('.valRect').remove();
            svg.selectAll('.valRect')
                .data(rectData).enter()
                .append('rect').attr('class','valRect')
                .attr('x',d=>d.x)
                .attr('y',d=> centerY-(d.height/2))
                .attr('height',d=>d.height)
                .attr('fill',getFill)
                .attr('stroke-width',.1)
                .attr('stroke','grey')
                .attr('width',barWidth-4)
                .attr('fill',getFill)
                .on('mouseover',function(e,d){
                    const string = d.name + '</br>' + d.value + '</br>' + d.scaledVal;
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            svg.selectAll('.outcome').remove();
            svg.selectAll('.outcome')
                .data(outcomeData).enter()
                .append('circle').attr('class','outcome')
                .attr('cx',d=>d.x)
                .attr('cy',d=> centerY)
                .attr('r',d=>d.height/2)
                .attr('fill',getFill)
                .attr('stroke-width',.1)
                .attr('stroke','grey')
                .attr('fill',getFill)
                .on('mouseover',function(e,d){
                    const string = d.name + '</br>' + d.value + '</br>' + d.scaledVal;
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            // svg.selectAll('.d3label').remove();
            // svg.selectAll('.d3label')
            //     .data(rectData).enter()
            //     .append('text').attr('class','d3label')
            //     .attr('text-anchor','middle')
            //     .attr('y',height )
            //     .attr('textLength',getWidth)
            //     .attr('lengthAdjust','spacingAndGlyphs')
            //     .attr('x',d=>d.x+(barWidth*.5))
            //     .attr('fontSize', 1)
            //     .text(d=>Utils.getFeatureDisplayName(d.name));
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