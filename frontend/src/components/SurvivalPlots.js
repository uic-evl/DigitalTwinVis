import React, {useState, useEffect, useRef, useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import '../App.css';


function getConfidenceIntervals(survivalLists){
    const nsamples = survivalLists.length;
    const ndates = survivalLists[0].length;
    let topVals = [];
    let bottomVals = [];
    for(let i in survivalLists[0]){
        let tValues = survivalLists.map(s => s[i])
        tValues.sort();
        let top = tValues[tValues.length-2];
        let bottom = tValues[1];
        topVals.push(top);
        bottomVals.push(bottom);
    }
    return [topVals,bottomVals]
}

export default function SurvivalPlots(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const curvesToPlot = constants.TEMPORAL_OUTCOMES;
    
    const xMargin = 20;
    const yMargin = 20;
    const xTickSpacing = 20;
    const yTickSpacing = 40;
    const titleSpacing = 20;
    const legendSpacing = Math.min(width/2,Math.max(80,width/10));
    const maxTime = 60;
    useEffect(()=>{
        if(svg === undefined | props.sim === undefined | props.altSim === undefined){return}
        const sim = props.sim;
        const altSim = props.altSim;
        const survivalCurves = sim['survival_curves'];
        const altCurves = altSim['survival_curves'];

        const survivalBootstrapped = sim['survival_curves_bootstrapped'];
        const altSurvivalBootstrapped = altSim['survival_curves_bootstrapped'];

        const chartHeight = (height/curvesToPlot.length) - 1.5*yMargin;
        const chartWidth = width - 2*xMargin;
        const times = survivalCurves.times.filter(d=>d<=maxTime);
        const xScale = d3.scaleLinear()
            .domain([times[0],times[times.length-1]])
            .range([xMargin + yTickSpacing,width-xMargin-legendSpacing]);
        const lineColors = sim.currDecision >= .5? [constants.dnnColor,constants.dnnColorNo,constants.knnColor,constants.knnColorNo]: [constants.dnnColorNo,constants.dnnColor,constants.knnColorNo,constants.knnColor];
        
        function makeChart(name,topPos){
            
            const censorVar = constants.censorVars[constants.TEMPORAL_OUTCOMES.indexOf(name)%constants.censorVars.length];
            //list of surivival at each timepoint
            const curves = survivalCurves[name];
            const alt = altCurves[name]   

            //list of list of survival probs at each timepoint, each an iteration using dropout
            const [curvesTop,curvesBottom] = getConfidenceIntervals(survivalBootstrapped[name]);
            const [altTop,altBottom] = getConfidenceIntervals(altSurvivalBootstrapped[name]);
            const yScale = d3.scaleLinear()
                .domain([0,1])
                .range([topPos + chartHeight - xTickSpacing, topPos + titleSpacing]);
            const lineFunc = d3.line()
                // .x(d=>d.x)
                // .y(d=>d.y);
                // .x((d,i) => xScale(times[i]))
                // .y(d=>yScale(d));

            const selector=name.replace('.','').replace(')','').replace('(','').replace('.','').replace(' ','').replace(' ','');

            svg.selectAll('g').filter('.g'+selector).remove();
            const g = svg.append('g').attr('class','g'+selector)
                .style('outline','3px solid rgba(40,40,40,.1)')
                .style('outline-offset', '2px')
                .style('border-radius','10px');

            var curveData = [];
            var pointData = [];

            const timeToEvent = sim[name];
            const altTimeToEvent = altSim[name];
            const knnTTE = Utils.mean(props.neighbors.map(d=>d[censorVar])) > .5? Infinity: Utils.median(props.neighbors.map(d=>d[name]));
            const altKnnTTE = Utils.mean(props.cfs.map(d=>d[censorVar])) > .5? Infinity: Utils.median(props.cfs.map(d=>d[name]));
            const ttes =  [timeToEvent,altTimeToEvent,knnTTE,altKnnTTE];
            const curveNames = sim.currDecision >= .5? ['Treatment (predicted)', 'No Treatment (predicted)','Treated (neighbors)','No Treatment (neighbors)']: ['No Treatment (predicted)', 'Treatment (predicted)','No Treated (neighbors)','Treatment (neighbors)'];
            
            for(let ii in [curves,alt]){
                let cVals = [curves,alt][ii];
                let path = [];
                for(let i in cVals){
                    let cx = xScale(times[i]);
                    let cy = yScale(cVals[i]);
                    path.push([cx,cy]);
                    pointData.push({
                        'x': cx,
                        'y': cy,
                        'color': lineColors[ii],
                        'value': cVals[i],
                        'time': times[i],
                        'name': curveNames[curveData.length],
                    })
                }
                curveData.push({
                    'path': lineFunc(path),
                    'color': lineColors[ii],
                    'medianTime': ttes[curveData.length],
                    'name': curveNames[curveData.length],
                    'values': cVals,
                })
            }

            for(let nList of [props.neighbors,props.cfs]){
                let pCurve = [];
                let pcts = [];
                for(let time of times){
                    // const nAbove = nList.filter(d => d[name] >= time);
                    //patient who are either censored or died later (basically we assume alive)
                    const nAbove = nList.filter(d => d[name] > time || d[censorVar] > .5);
                    let pctAbove = nAbove.length/nList.length;
                    pcts.push(pctAbove);
                    let cx = xScale(time);
                    let cy = yScale(pctAbove);
                    pCurve.push([xScale(time),yScale(pctAbove)]);
                    pointData.push({
                        'x': cx,
                        'y': cy,
                        'color': lineColors[curveData.length],
                        'value': pctAbove,
                        'time': time,
                        'name': curveNames[curveData.length],
                    })
                }
                curveData.push({
                    'path': lineFunc(pCurve),
                    'color': lineColors[curveData.length],
                    'medianTime': ttes[curveData.length],
                    'name': curveNames[curveData.length],
                    'values': pcts,
                });
            }

            var currCurve = 0;
            var curveStuff = [[curvesTop,curvesBottom],[altTop,altBottom]];
            var CICurveData = [];
            for(const [top,bottom] of curveStuff){
                var path = [];
                // var pathBottom = [];
                for(let i in top){
                    let cx = xScale(times[i]);
                    let cy = yScale(top[i]);
                    path.push([cx,cy]);
                }
                for(let i in bottom){
                    let idx = bottom.length-1-i;
                    let cx = xScale(times[idx]);
                    let cy = yScale(bottom[idx]);
                    path.push([cx,cy]);
                }

                path.push(path[0])
                CICurveData.push({
                    'path': lineFunc(path),
                    'color': lineColors[currCurve],
                    'name': curveNames[currCurve] + '_CI',
                })

                currCurve += 1;
            }
            console.log(CICurveData)
            var CIPath = g.selectAll('path').filter('.ciPath'+selector).data(CICurveData,(d,i) =>d.name+i+'ci');
            //use different lines, keep extents so people don't see 
            CIPath.enter()
                .append('path').attr('class','ciPath'+selector)
                .merge(CIPath)
                .attr('d',d=>d.path)
                .attr('stroke-width',1)
                .attr('stroke',d=>d.color)
                .attr('stroke-opacity',1)
                .attr('fill-opacity',.2)
                .attr('fill',d=>d.color);
            CIPath.exit().remove();

            var path = g.selectAll('path').filter('.path'+selector).data(curveData,(d,i) =>d.name+d.x);
            //use different lines, keep extents so people don't see 
            path.enter()
                .append('path').attr('class','path'+selector)
                .merge(path)
                // .transition(100)
                .attr('d',d=>d.path)
                .attr('stroke-width',2)
                .attr('stroke',d=>d.color)
                .attr('opacity',1)
                .attr('fill','none');
            path.exit().remove();

            var points = g.selectAll('.'+'points'+selector).data(pointData,(d,i)=>d.name+d.x);
            points.enter()
                .append('circle').attr('class','points'+selector)
                .attr('cx',d=>d.x)
                .merge(points)
                // .transition(300)
                .attr('cy',d=>d.y)
                .attr('fill',d=>d.color)
                .attr('r',4)
            points.exit().remove();

            g.selectAll('.'+'points'+selector).on('mouseover',function(e,d){
                let string = d.value? d.name +  '</br>' 
                    + (100*d.value).toFixed(0) + '% at ' + d.time + 'm': 'd.name';
                tTip.html(string);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            });

            g.selectAll('.path'+selector).on('mouseover',function(e,d){
                let string = d.name + '</br>' + 'Median Time To Event: ' + d.medianTime.toFixed(0) + ' Months' + '</br>';
                string += '----------</br>Likelihood At:'
                for(let i in times){
                    let val = d.values[i];
                    if(val !== undefined){
                        string += '</br>' + times[i] +' Months: ' + (100*val).toFixed(0) + '%';
                    }
                }
                tTip.html(string);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            });

            let textStuff = [{
                'x':(width-legendSpacing)/2,
                'y': yScale(1) - titleSpacing/2, 
                'size': titleSpacing*.9,
                'text': Utils.getFeatureDisplayName(name),
                'anchor': 'middle',
                'weight':'bold'
            }];
            const tickY =  yScale(0) + xTickSpacing/2;
            textStuff.push({
                'x': xMargin/2,
                'y': tickY,
                'size': xTickSpacing*.8,
                'text': 'Months:',
                'anchor':'start',
                'weight': 'bold',
                'textWidth': xScale(0) - xMargin/2 -2,
            })
            for(let time of times){
                let entry = {
                    'x': xScale(time),
                    'y': tickY,
                    'size': xTickSpacing*.8,
                    'text': time,
                    'anchor':'middle',
                    'weight': '',
                    'textWidth': '',
                }
                textStuff.push(entry);
            }

            const xStart = xScale(0);
            const xEnd = xScale(times[times.length-1]);
            //use this for any lines you want to use
            for(let pct of [0,.25,.5,.75,1]){
                let y = yScale(pct)
                let isBound = pct == 0 || pct == 1;
                textStuff.push({
                    'x': xMargin,
                    'y': y,
                    'size': xTickSpacing*.8,
                    'text': (pct*100).toFixed(0) + '%',
                    'anchor':'start',
                    'weight': '',
                    'line': lineFunc([[xStart,y],[xEnd,y]]),
                    'textWidth':'',
                    'isBound': isBound,

                })
            }
            g.selectAll('.text'+selector).remove();
            g.selectAll('.text'+selector).data(textStuff)
                .enter().append('text')
                .attr('class','text'+selector)
                .attr('font-size',d=>d.size)
                .attr('dominant-baseline','middle')
                .attr('text-anchor',d=>d.anchor)
                .attr('font-weight',d=>d.weight)
                .attr('text-length',d=>d.textWidth)
                .attr('lengthAdjust','spacingAndGlyphs')
                .attr('x',d=>d.x)
                .attr('y',d=>d.y)
                .html(d=>d.text);

            g.selectAll('.axisTick'+selector).remove();
            g.selectAll('.axisTick'+selector).data(textStuff)
                .enter().append('path').attr('class','axisTick'+selector)
                .attr('d',d=>d.line)
                .attr('stroke',d=>d.isBound? 'black':'azure')
                .attr('stroke-width',d=>d.isBound? 3:2)
                .attr('stroke-dasharray', d=>d.isBound? '5,5':'')
                .attr('pointer-events','none')
                .attr('stroke-opacity',d=>d.isBound? .5:1);

            //old code to draw a legend with fixed dates
            // const lX = xScale.range()[1]+2;
            // var lY = yScale(1);
            // const lTextSize = Math.min(16,xTickSpacing*.8);
            // const lWidth = Math.min(legendSpacing/2,lTextSize);
            // var legendData = [{
            //     'color': 'none',
            //     'x': 0,
            //     'y': lY,
            //     'textX': lX + (lWidth),
            //     'text': 'Median Time',
            //     'size': lTextSize,
            //     'name': ''
            // }];
            // lY += lWidth*1.2 + 2
            // for(let tte of ttes){
            //     let color = lineColors[legendData.length-1];
            //     legendData.push({
            //         'color': color,
            //         'x': lX,
            //         'textX': lX+lWidth+2,
            //         'y': lY,
            //         'text': tte === Infinity? 'Indefinite' : tte.toFixed(0) + ' m',// tte <= 48? tte.toFixed(0)+'m': '>4Yr' ,
            //         'size': lTextSize,
            //         'name': curveNames[legendData.length-1],
            //     });
            //     lY += lWidth + 2;
            // }
            // g.selectAll('.legendItem'+selector).remove();
            // g.selectAll('.legendItem'+selector).filter('rect')
            //     .data(legendData).enter()
            //     .append('rect').attr('class','legendItem'+selector)
            //     .attr('x',d=>d.x).attr('y',d=>d.y)
            //     .attr('width',lWidth).attr('height',lWidth)
            //     .attr('fill',d=>d.color)
            //     .on('mouseover',function(e,d){
            //         let string=d.name;
            //         if(d.text === 'Indefinite'){
            //             string += '</br> >50% Survive after their last follow up'
            //         } else{
            //             string += '</br>Median Survival: '+d.text + 'onths';
            //         }
                    
            //         tTip.html(string);
            //     }).on('mousemove', function(e){
            //         Utils.moveTTipEvent(tTip,e);
            //     }).on('mouseout', function(e){
            //         Utils.hideTTip(tTip);
            //     });

            // g.selectAll('.legendItem'+selector).filter('text')
            //     .data(legendData).enter()
            //     .append('text').attr('class','legendItem'+selector)
            //     .attr('x',d=>d.textX).attr('y',d=>d.y+(lWidth/2))
            //     .attr('font-size',d=>d.size)
            //     .attr('dominant-baseline','middle')
            //     .attr('font-weight',(d,i)=> i===0? 'bold':'')
            //     .attr('text-anchor',(d,i)=> i===0? 'middle':'start')
            //     .text(d=>d.text)
        }
        var currPos = yMargin;
        for(let cName of curvesToPlot){
            makeChart(cName,currPos);
            currPos += chartHeight + yMargin;
        }
    },[svg,props])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}