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

    const cWidth = d3Container.current? d3Container.current: 0;

    const curvesToPlot = constants.TEMPORAL_OUTCOMES;
    
    const xMargin = 20;
    const yMargin = 20;
    const xTickSpacing = 20;
    const yTickSpacing = 40;
    const titleSpacing = 20;
    const legendSpacing = Math.min(width/2,Math.max(150,width/5));
    const maxTime = 60;
    const fixedTimes = [24,60];
    useEffect(()=>{
        if(svg === undefined | props.sim === undefined | props.altSim === undefined){return}
        const sim = props.sim;
        const altSim = props.altSim;
        const survivalCurves = sim['survival_curves'];
        const altCurves = altSim['survival_curves'];

        const outcomesToShow = props.outcomesToShow? props.outcomesToShow: ['Treatment (predicted)','No Treatment (predicted)'];

        // const outcomesToShow = ['Treatment (predicted)','Treatment (neighbors)'];

        const survivalBootstrapped = sim['survival_curves_bootstrapped'];
        const altSurvivalBootstrapped = altSim['survival_curves_bootstrapped'];

        const chartHeight = (height/curvesToPlot.length) - 1.5*yMargin;
        const chartWidth = width - 2*xMargin;
        const times = survivalCurves.times.filter(d=>d<=maxTime);
        const legendStart = width-xMargin-legendSpacing;
        const xScale = d3.scaleLinear()
            .domain([times[0],times[times.length-1]])
            .range([xMargin + yTickSpacing,legendStart]);
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
            const curveNames = sim.currDecision >= .5? ['Treatment (predicted)', 'No Treatment (predicted)','Treatment (neighbors)','No Treatment (neighbors)']: ['No Treatment (predicted)', 'Treatment (predicted)','No Treated (neighbors)','Treatment (neighbors)'];
            
            let cPos = 0;
            for(let ii in [curves,alt]){
                if(outcomesToShow.indexOf(curveNames[cPos]) < 0){
                    cPos += 1;
                    continue
                }
                let cVals = [curves,alt][ii];
                let path = [];
                for(let i in cVals){
                    let cx = xScale(times[i]);
                    let cy = yScale(cVals[i]);
                    path.push([cx,cy]);
                    const pEntry = {
                        'x': cx,
                        'y': cy,
                        'color': lineColors[ii],
                        'value': cVals[i],
                        'time': times[i],
                        'name': curveNames[cPos],
                    };
                    pointData.push(pEntry);
                }
                curveData.push({
                    'path': lineFunc(path),
                    'color': lineColors[ii],
                    'medianTime': ttes[cPos],
                    'name': curveNames[cPos],
                    'values': cVals,
                });
                cPos+=1;
            }

            for(let nList of [props.neighbors,props.cfs]){
                if(outcomesToShow.indexOf(curveNames[cPos]) < 0){
                    cPos += 1;
                    continue
                }
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
                    const pEntry = {
                        'x': cx,
                        'y': cy,
                        'color': lineColors[cPos],
                        'value': pctAbove,
                        'time': time,
                        'name': curveNames[cPos],
                    }
                    pointData.push(pEntry);
                }
                curveData.push({
                    'path': lineFunc(pCurve),
                    'color': lineColors[cPos],
                    'medianTime': ttes[cPos],
                    'name': curveNames[cPos],
                    'values': pcts,
                });
                cPos += 1;
            }


            var currCurve = 0;
            var curveStuff = [[curvesTop,curvesBottom],[altTop,altBottom]];
            const ciCurveNames = [curveNames[0], curveNames[1]];
            var CICurveData = [];
            for(const [top,bottom] of curveStuff){
                if(outcomesToShow.indexOf(ciCurveNames[currCurve]) < 0){
                    currCurve += 1;
                    continue;
                }
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
            var CIPath = g.selectAll('path').filter('.ciPath'+selector).data(CICurveData,(d,i) =>d.name+i+'ci');
            //use different lines, keep extents so people don't see 
            CIPath.enter()
                .append('path').attr('class','ciPath'+selector)
                .merge(CIPath)
                .attr('d',d=>d.path)
                .attr('stroke-width',1)
                .attr('stroke',d=>d.color)
                .attr('stroke-opacity',1)
                .attr('fill-opacity',.25)
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

            const lXScale = d3.scaleLinear()
                .domain([0,1])
                .range([0, width- 2*xMargin - legendStart]);
            var lData = [];
            var lTitles = [];
            var lYPos = topPos - yMargin/2;
            const lStroke = 2;
            var lMargin = .5;
            var lBarHeight = (chartHeight)/(fixedTimes.length*5) - lMargin - lStroke;
            for(let t of fixedTimes){
                lTitles.push({
                    'y': lYPos,
                    'text': Utils.getNameShort(name) + ' @ ' + (t/12).toFixed(0) + ' Yrs',
                })
                lYPos += lBarHeight;
                let fPoints = pointData.filter(d=>d.time === t);
                let ii = 0;
                for(let fp of fPoints){
                    let lEntry = {
                        'color': fp.color,
                        'name': fp.name,
                        'time': t,
                        'value': fp.value,
                        'width': lXScale(fp.value),
                        'x': legendStart + xMargin,
                        'y': lYPos,
                        'height': lBarHeight,
                    }
                    lData.push(lEntry);
                    lYPos += lBarHeight + lMargin + lStroke;
                }
                lYPos += yMargin/2
            }

            g.selectAll('.legendBar'+selector).remove();
            g.selectAll('.legendBar'+selector).data(lData)
                .enter().append('rect')
                .attr('class','legendBar'+selector)
                .attr('x',d=>d.x).attr('y',d=>d.y)
                .attr('fill',d=>d.color)
                .attr('height',d=>d.height)
                .attr('width',d=>d.width)
                .attr('opacity',.75);

            g.selectAll('.legendBarOutline'+selector).remove();
            g.selectAll('.legendBarOutline'+selector).data(lData)
                .enter().append('rect')
                .attr('class','legendBarOutline'+selector)
                .attr('x',d=>d.x).attr('y',d=>d.y)
                .attr('stroke','black')
                .attr('fill','none').attr('stroke-width',lStroke)
                .attr('height',d=>d.height)
                .attr('width',lXScale(1));

            g.selectAll('.legendBarText'+selector).remove();
            g.selectAll('.legendBarText'+selector).data(lData)
                .enter().append('text')
                .attr('class','legendBarOutline'+selector)
                .attr('x',legendStart+lXScale(.5))
                .attr('y',d=>d.y + (lBarHeight/2) + (lStroke/2))
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .attr('font-size',lBarHeight/1.3)
                .attr('font-weight','bold')
                .attr('stroke','white').attr('stroke-width',.2)
                .text(d=>(100*d.value).toFixed(0)+'%');

            g.selectAll('.legendBarTitle'+selector).remove();
            g.selectAll('.legendBarTitle'+selector).data(lTitles)
                .enter().append('text')
                .attr('class','legendBarOutline'+selector)
                .attr('x',legendStart + xMargin)
                .attr('y',d=>d.y + (lBarHeight/2) + (lStroke/2))
                .attr('text-anchor','start')
                .attr('dominant-baseline','middle')
                .attr('font-size',lBarHeight/1)
                .attr('font-weight','bold')
                .text(d=>d.text);
            
        }
        var currPos = yMargin;
        for(let cName of curvesToPlot){
            makeChart(cName,currPos);
            currPos += chartHeight + yMargin;
        }
    },[svg,props,cWidth])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}