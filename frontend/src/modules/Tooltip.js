import React, { useRef, useEffect, useState } from 'react';
import '../App.css';
import * as d3 from 'd3';
import Utils from './Utils.js';


export function makeTipChart(element, data, size, paths, plotVar, dColor, dScale){
    let [w,h] = size;
    let doseSvg = Utils.addTTipCanvas(element,'tTipDoseCanvas',w,h);

    if(paths === undefined | paths['both'] === undefined){
        console.log('error getting svg paths for tooltip',paths);
        return;
    }

    let svgOrganList = Object.keys(paths['both']);
    let maxDVal = 70;
    let minDVal = 0;
    let values = data[plotVar];

    let pathData = [];
    for(let organ of svgOrganList){
        let pos = data.organList.indexOf(organ);
        if(pos < 0){ continue; }
        let dVal = values[pos];
        let path = paths['both'][organ];
        let entry = {
            'dVal': dVal,
            'organ_name': organ,
            'plotVar': plotVar,
            'path': path,
        }
        pathData.push(entry)
        if(dVal > maxDVal){ maxDVal = dVal; }
        if(dVal < minDVal){ minDVal = dVal; }
    }

    doseSvg.selectAll('g').filter('.organGroup').remove();
    const organGroup = doseSvg.append('g')
        .attr('class','organGroup');
    
    organGroup.selectAll('.organPath').remove();

    let getColor = d => dColor(dScale(d.dVal));
    organGroup
        .selectAll('path').filter('.organPath')
        .data(pathData)
        .enter().append('path')
        .attr('class','organPath')
        .attr('d',x=>x.path)
        // .attr('transform',(d,i)=>transforms[i])
        .attr('fill', getColor)
        .attr('stroke','black')
        .attr('stroke-width','.1');

    let box = doseSvg.node().getBBox();
    let transform = 'translate(' + (-box.x)*(w/box.width)  + ',' + (-box.y)*(h/box.height) + ')';
    transform += ' scale(' + w/box.width + ',' + (-h/box.height) + ')';
    doseSvg.selectAll('g').attr('transform',transform);
}
    
export function makeTipLrtChart(element, data, size, symptoms){
    let [w,h] = size
    h = h*symptoms.length
    const margin = 5;
    
    const maxHeight = (.5*h/symptoms.length) - 2;
    const fontSize = Math.min(2*maxHeight, 10);
    const textWidth = fontSize*7;

    const maxWidth = (w-textWidth-2*margin)/20;
    const radius = Math.min(maxHeight,maxWidth);
    
    let tipSvg = Utils.addTTipCanvas(element, 'scatterTipSvg',w+2*margin,h+2*margin);
    tipSvg.attr('background','white')
    let xScale = d3.scaleLinear()
        .domain([0,10])
        .range([margin+textWidth+2*radius,w-margin-2*radius])
    let yScale = d3.scaleLinear()
        .domain([0,symptoms.length-1])
        .range([h-margin-radius*2,margin + 2*radius]);
    let sVals = symptoms.map((s,i) => {
        let entry = {
            'treatment': getMaxSymptoms(data,s, [0,2,3,4,5,6,7]),
            '6W': getMaxSymptoms(data,s,[13]),
            '6M': getMaxSymptoms(data,s,[33]),
            'name': s,
            'y': yScale(i),
        }
        return entry
    });
    
    
    var plotDots = function(xKey,color){
        let cString = '.TipCircle'+xKey;
        // tipSvg.selectAll(cString).remove();
        let dots = tipSvg.selectAll(cString)
            .data(sVals)
            .enter().append('circle')
            .attr('class', 'TipCircle'+xKey)
            .attr('cy',d=>d.y)
            .attr('fill',color)
            .attr('r',radius)
            .attr('cx',d=> xScale(d[xKey]));
        return dots;
    }
    // plotDots('treatment','green');
    plotDots('6W','grey');
    plotDots('6M','black');


    tipSvg.selectAll('text').filter('.symptomText')
        .data(sVals).enter()
        .append('text').attr('class','symptomText')
        .attr('x',1).attr('y',d=>d.y+(fontSize/2))
        .attr('text-width',textWidth)
        .attr('font-size',fontSize)
        .html(d=>d.name+'|')

    const lineFunc = d3.line();
    let axisLines = [3,5].map(v=>{
        let path = lineFunc([
            [xScale(v),yScale(0)],
            [xScale(v),yScale(symptoms.length+.5)]
        ])
        let name = '' + v;
        let entry = {
            'path': path,
            'value':v,
            'x': xScale(v),
            'name': name,
        }
        return entry
    })
    tipSvg.selectAll('path').filter('.axisLines').remove();
    tipSvg.selectAll('path').filter('.axisLines')
        .data(axisLines).enter()
        .append('path')
        .attr('class','axisLines')
        .attr('d',d=>d.path)
        .attr('stroke-width',2)
        .attr('stroke','white')
        .attr('stroke-opacity',1)
        .attr('fill','none');
    tipSvg.selectAll('text').filter('.xAxisText')
        .data(axisLines).enter()
        .append('text').attr('class','xAxisText')
        .attr('x',d=>d.x)
        .attr('y',h)
        .attr('text-anchor','middle')
        .attr('font-size',fontSize)
        .attr('textWidth',textWidth)
        .html(d=>d.name)
}

function getMaxSymptoms(pEntry,symptom,dates){
    let val = pEntry['symptoms_'+symptom];
    if(val === undefined | pEntry.dates === undefined){
        return -1;
    }
    let dateIdxs = dates.map(x => pEntry.dates.indexOf(x)).filter(x => x > -1);
    let values = dateIdxs.map(i => val[i]).filter(x => x!==undefined);
    if(values.length > 1){
        return Math.max(...values);
    } else{
        return values[0];
    }
}
