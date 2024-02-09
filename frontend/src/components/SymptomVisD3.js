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
        if(svg !== undefined & props.treated !== undefined){

            const weeks = props.dates;
            const xScale = d3.scaleLinear()
                .domain([weeks[0],weeks[weeks.length-1]])
                .range([xMargin[0], width-xMargin[1]]);
            const yScale = d3.scaleLinear()
                .domain([0,10])
                .range([height-yMargin[1],yMargin[0]]);

            var line = d3.line().curve(d3.curveBumpX);

            function makeDataset(data,lineColor,isFirst,ids,dists){
                const ratings = data.ratings;//lists of ratings shape (props.ids, weeks)
                const means = data.means;//lists of mean ratings shape weeks
                
                var lineData = ratings.map(d=>[]);
                var meanLine=[];
                var textData = [];
                if(isFirst){
                    textData = [{
                        'text': props.name,
                        'x': width/2,
                        'y': yMargin[0]/2,
                        'fontSize': yMargin[0]*.8,
                    }];
                }
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
                    if(isFirst){
                        textData.push({
                            'text': wk,
                            'x': x,
                            'y': height-yMargin[1]/2,
                            'fontSize': yMargin[1]*.6,
                        });
                    }
                }
                lineData.splice(0,0,meanLine);

                let lines = lineData.map((d,i)=>{ return {
                    'path': line(d),
                    'ratings': d.map(v => yScale.invert(v[1])),
                    'color': lineColor,
                    'isMean': i===0,
                    'pId': ids[parseInt(i)],
                    'distance': dists[parseInt(i)],
                    'treated': isFirst,
                }});
                return [lines, textData];
            }
            
            let [lineD, textD]= makeDataset(props.treated,constants.knnColor,true,props.treatedIds,props.treatedDists);
            let [lineD2, textD2] = makeDataset(props.untreated, constants.knnColorNo,false,props.untreatedIds,props.untreatedDists);

            
            svg.selectAll('.symptomLine').remove();
            const lineD3 = svg.selectAll('path').filter('.symptomLine')
                .data(lineD.concat(lineD2)).enter().append('path')
                .attr('class', (d,i) => d.isMean? 'symptomLine meanLine':'symptomLine')
                .attr('d',d=>d.path)
                .attr('stroke',d => d.color)
                .attr('stroke-width',d => d.isMean? 8:4)
                .attr('opacity',d => d.isMean? 1:.1)
                .attr('fill','none')
                .on('mouseover',function(e,d){
                    let string = (d.treated? 'Treated':'Untreated');
                    if(d.isMean){
                        string += " (Mean)"
                    } else{
                        string += '</br>similiarty: ' + (1/(1+d.distance)).toFixed(2);
                    }
                    string += '</br> Ratings: ';
                    for(let r in d.ratings){
                        string += '| wk ' + weeks[r] + ': ' + d.ratings[r].toFixed(0);
                    }
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

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
                .attr('pointer-events','none')
                .attr('stroke-width',4);

            svg.selectAll('.annotationText').remove();
            svg.selectAll('text').filter('annotationText')
                .data(textD).enter().append('text')
                .attr('class','annotationText')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .attr('font-size',d=>d.fontSize)
                .attr('font-weight',(d,i)=>i===0? 'bold':'')
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .text(d=>Utils.getVarDisplayName(d.text))

        }
    },[svg,props.treated,props.untreated]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}
