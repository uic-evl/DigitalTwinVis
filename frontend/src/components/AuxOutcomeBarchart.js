import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function AuxOutcomeBarchart(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    // const outcomeGroups = {'temporal': ['OS (Calculated)']}
    // const timePoints = [12,36,48]

    const xMargin = 10;
    const topMargin =10;
    const chartSpacing = 15;
    const bottomMargin = 20;
    // const timePoints = [12,48];


    function getTickText(t){
        let tnew = Utils.nameDictShort[t];
        if(tnew !== undefined){
            return tnew;
        }
        t = t.replace('dlt','').replace('DLT','').replace('_',' ').replace(' (Pneumonia)','').replace('2','');
        return Utils.getFeatureDisplayName(t);
    }
    const settings = useMemo(()=>{
        var omap = {};
        var tp = [6];
        if(props.outcomesView === 'survival'){
            omap['temporal'] = ['OS (Calculated)','Locoregional control (Time)','FDM (months)'];
            tp = [12,48]
            return {'omap': omap, 'tp': tp};
        }
        if(props.outcomesView === 'endpoints'){
            omap['temporal'] = ['OS (Calculated)','Locoregional control (Time)','FDM (months)']
            omap['outcomes'] = constants.OUTCOMES;
            tp = [48];
            return {'omap': omap, 'tp': tp}
        }
        if(props.outcomesView === 'dlts'){
            if(props.currState === 1){
                omap['dlt2'] = constants.dlts2;
            } else if(props.currState === 0){
                omap['dlt1'] = constants.dlts1;   
            }
            return {'omap': omap, 'tp': tp}
        }
        if(props.outcomesView === 'disease response'){
            if(props.currState === 1){
                omap['pd2'] = constants.primaryDiseaseProgressions2;
                omap['nd2'] = constants.nodalDiseaseProgressions2;
            } else if(props.currState === 0){
                omap['pd1'] = constants.primaryDiseaseProgressions;
                omap['nd1'] = constants.nodalDiseaseProgressions;
            }
            return {'omap': omap,'tp': tp}
        }

        omap['temporal'] = ['OS (Calculated)','Locoregional control (Time)','FDM (months)']
        return {'omap': omap, 'tp': tp}
    },[props.currState,svg,props.outcomesView])
    
    useEffect(()=>{
        const outcomeGroups = settings.omap;
        const timePoints = settings.tp;
        if(!Utils.allValid([svg,props.sim,props.altSim,props.neighbors,props.cfs,timePoints,outcomeGroups])){
            console.log('not valid stuff in outcomeplots',props,timePoints,outcomeGroups);
        }else{
            
            const sim = props.sim;
            const altSim = props.altSim;
            const survivalCurves = sim['survival_curves'];
            const altCurves = altSim['survival_curves'];
            const times = survivalCurves.times;
            const timeIdxList = timePoints.map(t => times.indexOf(t)).filter(idx => idx >= 0);
            const lineColors = sim.currDecision >= .5? [constants.dnnColor,constants.dnnColorNo,constants.knnColor,constants.knnColorNo]: [constants.dnnColorNo,constants.dnnColor,constants.knnColorNo,constants.knnColor];
            
            var nPlots = 0;
            const groupSpacing =10;
            for(let [k,v] of Object.entries(outcomeGroups)){
                if(k === 'temporal'){
                    nPlots += v.length*timePoints.length;
                }else{
                    nPlots += k == 'outcomes'? 2:v.length;
                }
            }

            const barWidth = (width-2*xMargin - (nPlots-1)*groupSpacing)/(4*nPlots);
            var currX = xMargin;

            var yScale = d3.scaleLinear()
                .domain([0,1])
                .range([height-bottomMargin-1,topMargin])
            var barData = [];
            var barContainers = [];
            var confIntervals = [];
            for(const [k,varList] of Object.entries(outcomeGroups)){
                if(k == 'temporal'){
                    for(let tIdx of timeIdxList){
                        tIdx = Number(tIdx);
                        
                        for(let varIdx in varList){
                            let varName = varList[varIdx];
                            let censorVar = constants.censorVars[varIdx];
                            let kval = survivalCurves[varName][tIdx];
                            let altval = altCurves[varName][tIdx];
                            let nPct = props.neighbors.filter(d => d[censorVar] > 0  && d[varName] > times[tIdx]).length/props.neighbors.length;
                            let cfPct = props.cfs.filter(d => d[censorVar] > 0  || d[varName] > times[tIdx]).length/props.cfs.length;
                            let stuff = [kval,altval,nPct,cfPct];
                            const startX = currX;
                            for(let ii in stuff){
                                let val = stuff[ii];
                                let y = yScale(val)
                                barData.push({
                                    'value': val,
                                    'y':y,
                                    'minY': y,
                                    'maxY': y,
                                    'x': currX,
                                    'color': lineColors[ii],
                                    'varName': varName + times[tIdx],
                                })
                                currX += barWidth
                            }
                            barContainers.push({
                                'x': startX + ((currX - startX)/2),
                                'y': yScale(0) + bottomMargin/2,
                                'fontSize': Math.min(20,bottomMargin*.9),
                                'name': getTickText(varName) + '-' + times[tIdx] + 'm',
                                'maxWidth': currX - startX,
                            })
                            currX += groupSpacing;
                        }
                        
                    }
                } else{
                    let simVals = sim[k];
                    let altVals = altSim[k];
                    for(let varName of varList){
                        if(k === 'outcomes' && constants.TOXICITY.indexOf(varName) < 0){continue}
                        const startX = currX
                        let vPos = varList.indexOf(varName);
                        const kval = simVals[vPos];
                        const altval = altVals[vPos];
                        const nPct = Utils.mean(props.neighbors.map(d=>d[varName]));
                        const cfPct = Utils.mean(props.cfs.map(d=>d[varName]));
                        let stuff = [kval,altval,nPct,cfPct];

                        const confI = [sim[k+'_5%'][vPos],sim[k+'_95%'][vPos]];
                        const altConfI = [altSim[k+'_5%'][vPos],altSim[k+'_95%'][vPos]];
                        const cis = [confI,altConfI];

                        for(let ii in stuff){
                            let val = stuff[ii];
                            let y = yScale(val)
                            let entry ={
                                'value': val,
                                'y': y,
                                'minY': y,
                                'maxY': y,
                                'x': currX,
                                'color': lineColors[ii],
                                'varName': varName,
                            }
                            if(Number(ii) < cis.length){
                                let ci = cis[ii];
                                let path = d3.line()(ci.map(v =>[currX+barWidth/2,yScale(v)]));
                                confIntervals.push({
                                    'path': path,
                                    'lower': ci[0],
                                    'upper': ci[1],
                                    'varName': varName,
                                })

                                //I think this because y is reverse?
                                entry.maxY = Math.max(entry.maxY,yScale(ci[0]));
                                entry.minY = Math.min(entry.minY, yScale(ci[1]));
                            }
                            barData.push(entry);
                            currX += barWidth
                        }
                        
                        barContainers.push({
                            'x': startX + ((currX - startX)/2),
                            'y': yScale(0) + bottomMargin/2,
                            'fontSize': Math.min(16,bottomMargin),
                            'name': getTickText(varName),
                            'maxWidth': currX - startX,
                        })
                        currX += groupSpacing;
                    }
                    currX += groupSpacing;
                }
               
            }
            
            var bars = svg.selectAll('rect').filter('.bar').data(barData,(d,i)=>d.varName+d.color);
            bars.enter()
                .append('rect').attr('class','bar')
                .merge(bars).transition(300)
                .attr('x',d=>d.x).attr('width',barWidth-3)
                .attr('y', d=>d.y).attr('height',d=>height-bottomMargin-d.y)
                .attr('fill',d=>d.color);
            bars.exit().remove();

            var ticks = [];
            for(let tickVal of [.5,.75,1]){
                let y = yScale(tickVal);
                let path = [[xMargin,y],[currX,y]]
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
                .attr('stroke-width',2);

            var barNotes = svg.selectAll('text').filter('.barAnnotation').data(barData,(d,i)=>d.varName+d.color);
            const annotationSize = barWidth/2;
            barNotes.enter()
                .append('text').attr('class','barAnnotation')
                .merge(barNotes).transition(300)
                .attr('x',d=>d.x+((barWidth-4)/2))
                .attr('y', d=> (d.minY - 15) < topMargin? d.maxY + annotationSize*.6: d.minY - annotationSize*.6)
                .attr('font-size',barWidth/2)
                .attr('font-weight','bold')
                .attr('textLength',d=> d.value >= .1? barWidth-6: (barWidth-6)/2)
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .attr('lengthAdjust','spacingAndGlyphs')
                .text(d=>(100*d.value).toFixed(0));
            barNotes.exit().remove();

            var confs = svg.selectAll('path').filter('.conf').data(confIntervals,(d,i)=>d.varName+'conf')
            confs.enter()
                .append('path').attr('class','conf')
                .merge(confs)
                .transition(100)
                .attr('d',d=>d.path)
                .attr('fill','none')
                .attr('stroke-width',Math.max(1,barWidth/10))
                .attr('stroke','black')
            confs.exit().remove();

            

            svg.selectAll('.groupTitle').remove();
            svg.selectAll('.groupTitle').data(barContainers)
                .enter().append('text')
                .attr('class', 'groupTitle')
                .attr('x',d=>d.x).attr('y',d=>d.y)
                .attr('font-size',d=>d.fontSize)
                .attr('text-anchor','middle')
                .attr('dominant-baseline','middle')
                .attr('lengthAdjust','spacingAndGlyphs')
                .attr('textLength',d=>(d.name.length)*(.5*d.fontSize) >= d.maxWidth? d.maxWidth:'')
                .text(d=>d.name);

            barNotes.raise();

        }
    },[props.sim,props.altSim,props.neighbors,props.cfs,props.currState,svg,settings])

    const className = props.className? props.className:'';
    return (
        <div
            className={"d3-component " + className}
            style={{'height':'95%','width':'95%','overflowY':'scroll'}}
            ref={d3Container}
        ></div>
    );
}