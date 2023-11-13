import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";




export function NeighborVisD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    

    const ordinalVars = constants.ordinalVars;
    const booleanVars = constants.booleanVars;
    const continuousVars = constants.continuousVars;

    const colorVar = 'similarity';

    const margin = Math.max(20,height/10);

    //actually rectangle vars
    const baselineVars = Object.keys(ordinalVars)
        .concat(continuousVars)
        .concat(booleanVars.filter(d=> !d.includes('subsite')));

    

    function getVars(){
        switch(props.version){
            case 'continuous': 
                return continuousVars;
            case 'boolean':
                return booleanVars;
            case 'outcomes':
                return constants.OUTCOMES.map(i=>i).concat(['FDM']);
            case 'staging':
                return Object.keys(ordinalVars);
            case 'notStaging':
                return continuousVars.concat(booleanVars);
            case 'useful':
                return ['total_dose','hpv','age','bilateral','Aspiration rate Pre-therapy','packs_per_year']
            default:
                return baselineVars
        }
    }
    const allVars = getVars();


    function radToCartesian(r,t){
        const x = width/2 + r*Math.cos(t);
        const y = height/2 + r*Math.sin(t);
        return [x,y];
    };
    
    function radianToDegree(t){
        return t*(180/Math.PI)
    }

    const radiusScale = d3.scaleLinear()
                .domain([0,1])
                .range([5,width/2 - margin]);

            //catch out-of-bounds values
    const rScale = v => Math.min(radiusScale.range()[1], Math.max(radiusScale.range()[0],radiusScale(v)));

    useEffect(()=>{
        if(svg !== undefined & props.data !== undefined){
            var data = props.data;
            var refData = props.referenceData;
            if(props.version){
                data = Object.assign({},data);
                data['FDM'] = data['FDM (months)'] > 48;
    
            }
            const nVars = allVars.length;
            console.log('neighbor',data);

            const thetaScale = d3.scaleLinear()
                .domain([0,nVars])
                .range([Math.PI/2,2.5*Math.PI]);

    

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
                //gets weird if there's an out-of bounds value for continous stuff (since its ranged by the cohort bounds)
                let [x,y] = radToCartesian(radius,theta);
                let [xOutline, yOutline] = radToCartesian(rScale(1),theta);
                let [xText, yText] = radToCartesian(rScale(1), theta);
                let entry = {
                    'name': key,
                    'value': val,
                    'trueValue': trueVal,
                    'scaledVal': scaledVal,
                    'x': x,
                    'y': y,
                    'xText': xText,
                    'yText': yText,
                    'theta':theta,
                }
        
                pathPoints.push([x,y]);
                outlinePoints.push([xOutline,yOutline])
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
            outlinePoints.push(outlinePoints[0]);
            refPoints.push(refPoints[0])

            const pathData = [
                {
                    'path': pathPoints,
                    'fill': props.showTicks?'none':d3.interpolateGreys(.8*data.similarity**.3),
                    'stroke': 'black',
                    'sw':2,
                    'kind': 'main'
                },
                {
                    'path': outlinePoints,
                    'fill':'none',
                    'stroke': 'grey',
                    'sw': 1,
                    'kind': 'outline',
                },
            ];
            if(refData !== undefined){
                pathData.push({
                    'path': refPoints,
                    'fill': 'none',
                    'stroke': 'blue',
                    'sw': 2,
                    'kind': 'reference',
                })
            }

            var kPath = svg.selectAll('.kiviatPath').data(pathData)
            kPath.enter()
                .append('path').attr('class',d=> 'kiviatPath + kPath'+d.kind )
                .merge(kPath)
                .attr('d',d=>d3.line().curve(d3.curveCardinal.tension(.5))(d.path))
                .attr('stroke',d=>d.stroke).attr('stroke-width',d=>d.sw)
                .attr('fill',d=>d.fill);

            
            svg.selectAll('.kLabels').remove();
            if(props.showTicks){
                svg.selectAll('.kLabels').data(plotData)
                .enter()
                .append('text').attr('class','kLabels')
                .attr('x',d=>d.xText)
                .attr('y',d=>d.yText)
                .attr('font-size',Math.max(11,margin/3))
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .attr('font-weight',800)
                .attr('stroke','white')
                .attr('stroke-width',.1)
                // .attr('transform',d=> 'translate('+d.xText+','+d.yText+')rotate('+radianToDegree(-(d.theta+Math.PI/2)%Math.PI)+')')
                .text(d=>Utils.getFeatureDisplayName(d.name.replace('total_dose','dose').replace('packs_per_year','packs').replace('bilateral','Bilat.')));
            }

            svg.selectAll('.kPathreference').raise();
            svg.on('mouseover',(e,d)=>{
                let string = props.name;
                for(let entry of plotData){
                    string += '</br>' + entry.name + ': ' + entry.trueValue;
                }
                tTip.html(string);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            })
            
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
