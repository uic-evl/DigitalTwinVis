import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js'

export default function PatientDoseViewD3(props){
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pathsDrawn, setPathsDrawn] = useState(false);

    //to line up with stuff this is 1-4 items.  2-3 will be weird
    //4 shows a gradient within 
    const defaultPlotVars = ['V25','V35','V45','V55'];

    const tipChartSize = [150,80];
    const tipDvhValues = [5,20,25,30,35,40,45,50,55,60,65,70,75];

    function addPatientDvh(element, data,organ){
        element.selectAll('svg').remove();
        const margin = 3;
        const bottomMargin = 15;
        let [w,h] = tipChartSize;

        let tipSvg = element.append('svg')
            .attr('width',w)
            .attr('height',h)
            .style('background','white');

        let oPos = parseInt(data.organList.indexOf(organ));
        if(oPos < 0){
            console.log('patient dvh tooltip error',data,organ);
            return;
        }
        let tipXScale = d3.scaleLinear()
            .domain([0,Math.max(...tipDvhValues)])
            .range([margin, w-margin]);

        let tipYScale = d3.scaleLinear()
            .domain([0,100])
            .range([h-bottomMargin,margin]);
        let points = [];
        let validDvhValues = [];
        for(let v of tipDvhValues){
            let vName = 'V'+ v;
            let dVals = data[vName];
            if(dVals === undefined){
                continue;
            } else{
                validDvhValues.push(v);
            }
            let point = [tipXScale(v),tipYScale(dVals[oPos])]
            points.push(point)
        }
        const lineFunc = d3.line();

        tipSvg.append('path').datum(points)
            .attr('d',lineFunc)
            .attr('stroke','red')
            .attr('stroke-width',2)
            .attr('fill','none');

         //show x axis
         let ticks = [];
         //show every other x point
         let previousVal = -100;
         const fontSize = Math.min(13, Math.min(w,h)*.11);
         let minDiff = 6;
         for(let v of validDvhValues){
             let vDiff = v - previousVal;
             if(vDiff > minDiff){
                 let entry = {
                     name: 'V'+v,
                     x: tipXScale(v),
                     y: h - bottomMargin + fontSize,
                 }
                 ticks.push(entry);
                 previousVal = v;
             }
         }
 
         //plotting the x axis
         tipSvg.selectAll('text').filter('tipXAxis')
             .data(ticks).enter()
             .append('text').attr('class','tipXAxis')
             .attr('x',d=>d.x)
             .attr('y',d=>d.y)
             .attr('text-anchor','middle')
             // .attr('textLength',(w-2*margin)/(vals[0].length/2) )
             .attr('font-size',fontSize)
             .html(d=>d.name)
    }

    useEffect(function draw(){
        if(svg !== undefined & props.svgPaths !== undefined & props.data != undefined){

            svg.selectAll('g').remove();
            svg.selectAll('path').remove();
            setPathsDrawn(false);

            var getColor = props.getColor;
            if(getColor === undefined){
                getColor = d3.interpolateReds;
            }

            let orient = props.orient;
            var paths = props.svgPaths[orient];
            let svgOrganList = Object.keys(paths);
            let pathData = [];

            let maxDVal = 70;
            let minDVal = 0;
            //placehoder because I cant get stuff to work
            // let plotVar = props.plotVar;
            let plotVars = props.propsVars;
            if(plotVars === undefined){
                plotVars = defaultPlotVars;
            }
            for(let i in plotVars){
                i = parseInt(i);
                let plotVar = plotVars[i];
                let values = props.data[plotVar];
                // let scale =  Math.pow(.75,i);
                for(let organ of svgOrganList){
                    let pathName = organ;
                    if(i > 0){
                        pathName += (parseInt(i)+1);
                    }
                    let path = paths[pathName];
                    let pos = props.data.organList.indexOf(organ);
                    //skip if too many plot vars or the value to plot is missing
                    if(pos < 0 | path === undefined){ continue; }
                    let dVal = values[pos];
                    //for if we're comparing to a certain patient, calculate dose difference
                    if(props.baseline !== undefined){
                        dVal = dVal - props.baseline[plotVar][pos];
                    }
                    
                    let entry = {
                        // 'scale': scale,
                        'dVal': dVal,
                        // 'transform': 'scale('+scale+','+scale+')',
                        'organ_name': organ,
                        'plotVar': plotVar,
                        'path': path,
                        'mainPlotVal': props.data[props.plotVar][pos],
                    }
                    pathData.push(entry)
                    if(dVal > maxDVal){ maxDVal = dVal; }
                    if(dVal < minDVal){ minDVal = dVal; }
                }
            }
            

            svg.selectAll('g').filter('.organGroup').remove();
            const organGroup = svg.append('g')
                .attr('class','organGroup');
            
            organGroup.selectAll('.organPath').remove();

            var colorScale;
            if(minDVal < 0){
                let maxExtent = Math.max(Math.abs(minDVal),Math.abs(maxDVal))
                colorScale = d3.scaleDiverging()
                    .domain([-maxExtent,0,maxExtent])
                    .range([1,.5,0])//inversing because the colorscale is green - white - blue but I want blue to be negative
            } else{
                colorScale = d3.scaleLinear()
                    .domain([0,maxDVal])
                    .range([0,1])
            }
            const organShapes = organGroup
                .selectAll('path').filter('.organPath')
                .data(pathData)
                .enter().append('path')
                .attr('class','organPath')
                .attr('d',x=>x.path)
                // .attr('transform',(d,i)=>transforms[i])
                .attr('fill', x=>getColor(colorScale(x.dVal)))
                .attr('stroke','black')
                .attr('stroke-width',0)
                .on('mouseover',function(e){
                    let d = d3.select(this).datum();
                    let tipText = d.organ_name + '</br>' 
                        + d.plotVar + ': ' + d.dVal.toFixed(1) + '</br>'
                        + props.plotVar + ': ' + d.mainPlotVal + '</br>'
                    tTip.html(tipText);
                    addPatientDvh(tTip,props.data,d.organ_name)
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

                
            setPathsDrawn(true)
        }
    },[props.data,svg,props.svgPaths,props.plotVar])


    useEffect(()=>{
        if(svg !== undefined & pathsDrawn){
            let box = svg.node().getBBox();
            let transform = 'translate(' + (-box.x)*(width/box.width)  + ',' + (-box.y)*(height/box.height) + ')'
            transform += ' scale(' + width/box.width + ',' + (-height/box.height) + ')';
            svg.selectAll('g').attr('transform',transform);
        }
    },[props.data,svg,pathsDrawn]);

    return (
        <div
            className="d3-component"
            ref={d3Container}
        ></div>
    );
}