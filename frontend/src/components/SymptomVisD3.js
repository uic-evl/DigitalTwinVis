import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";




export default function SymptomVisD3(props){

    const d3Container = useRef(null);
    // const weeks = [0, 7, 13, 27];//should put these somewhere on the backend in case this changes idk;
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const xMargin = [10,10];
    const yMargin = [25,20];
    useEffect(()=>{
        if(svg !== undefined & props.data !== undefined){
            const data = props.data; //data, -1 is unknown for now
            const ratings = data.ratings;//lists of ratings shape (props.ids, weeks)
            const means = data.means;//lists of mean ratings shape weeks
            const weeks = props.dates;//
            console.log('weeks',weeks)
            const xScale = d3.scaleLinear()
                .domain([weeks[0],weeks[weeks.length-1]])
                .range([xMargin[0], width-xMargin[1]]);
            const yScale = d3.scaleLinear()
                .domain([0,10])
                .range([height-yMargin[1],yMargin[0]]);

            var line = d3.line().curve(d3.curveBumpX);
            var lineData = ratings.map(d=>[]);
            var meanLine=[];
            var textData = [{
                'text': props.name,
                'x': width/2,
                'y': yMargin[0]/2,
                'fontSize': yMargin[0]*.8,
            }];
            var dotData = [];
            for(let i in means){
                i = parseInt(i);
                const mVal = means[i];
                const wk = weeks[i];
                const x = xScale(wk);
                const nVals = ratings.map(d=>d[i]);
                meanLine.push([x,yScale(mVal)]);
                for(let ii in nVals){
                    ii = parseInt(ii)
                    const nVal = nVals[ii];
                    if(nVal >= 0){
                        let currLine = lineData[ii];
                        currLine.push([x,yScale(nVal)]);
                        lineData[ii] = currLine;
                    }
                }
                textData.push({
                    'text': wk,
                    'x': x,
                    'y': height-yMargin[1]/2,
                    'fontSize': yMargin[1]*.6,
                })
            }
            lineData.splice(0,0,meanLine);
            
            svg.selectAll('.symptomLine').remove();
            const lineD3 = svg.selectAll('path').filter('.symptomLine')
                .data(lineData).enter().append('path')
                .attr('class', (d,i) => i===0? 'symptomLine meanLine':'symptomLine')
                .attr('d',d=>line(d))
                .attr('stroke',(d,i)=> i===0? 'black':'grey')
                .attr('stroke-width',(d,i)=> i===0? 8:4)
                .attr('opacity',(d,i)=> i===0? 1:.4)
                .attr('fill','none');

            svg.selectAll('.meanLine').raise();

            var ticks = [];
            for(let tickVal of [.5,.75,1]){
                let y = yScale(tickVal*10);
                let path = [[xMargin[0],y],[width-xMargin[1],y]]
                ticks.push({
                    'path':d3.line()(path),
                    'val':tickVal,
                    'color': tickVal === 1? 'rgba(0,0,0,.5)': 'white',
                    'style': tickVal === 1? '5,5':'',
                })
            }

            svg.selectAll('path').filter('.ticks').remove();
            svg.selectAll('path').filter('.ticks').data(ticks)
                .enter()
                .append('path').attr('class','ticks')
                .attr('d',d=>d.path)
                .attr('fill','none')
                .attr('stroke',d=>d.color)
                .attr('stroke-dasharray',d=>d.style)
                .attr('stroke-width',4);

            svg.selectAll('.annotationText').remove();
            svg.selectAll('text').filter('annotationText')
                .data(textData).enter().append('text')
                .attr('class','annotationText')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('font-size',d=>d.fontSize)
                .attr('font-weight',(d,i)=>i===0? 'bold':'')
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .text(d=>Utils.getVarDisplayName(d.text))

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
