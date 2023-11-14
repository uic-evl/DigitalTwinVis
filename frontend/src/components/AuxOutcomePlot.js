import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function AuxOutcomePlot(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    

    const xMargin = 10;
    const topMargin =1;
    const chartSpacing = 15;
    const bottomMargin = 30;
    const timePoints = props.currState == 2? [12,48,60]:[12,48];


    function radToCartesian(r,t,centerX=0,centerY=0){
        const x = centerX + r*Math.cos(t);
        const y = centerY + r*Math.sin(t);
        return [x,y];
    };

    function getTickText(t){
        let tnew = Utils.nameDictShort[t];
        if(tnew !== undefined){
            return tnew;
        }
        t = t.replace('dlt','').replace('DLT','').replace('_',' ').replace('Nodal','').replace('Primary','').replace(' (Pneumonia)','').replace('2','');
        return Utils.getFeatureDisplayName(t);
    }
    const outcomeGroups = useMemo(()=>{
        var omap = {
            'temporal': ['OS (Calculated)','Locoregional control (Time)','FDM (months)','time_to_event'],
        }
        if(props.currState == 2){
            omap['outcomes'] = constants.OUTCOMES;
        } else if(props.currState == 1){
            omap['pd2'] = constants.primaryDiseaseProgressions2;
            omap['nd2'] = constants.nodalDiseaseProgressions2;
            omap['dlt2'] = constants.dlts2;
            
        } else{
            omap['pd1'] = constants.primaryDiseaseProgressions;
            omap['nd1'] = constants.nodalDiseaseProgressions;
            omap['dlt1'] = constants.dlts1;
        }
        if(svg) { 
            svg.selectAll('path').remove();
            svg.selectAll('text').remove();
        }
        return omap
    },[props.currState,svg])
    
    useEffect(()=>{
        if(!Utils.allValid([svg,props.sim,props.altSim,props.neighbors,props.cfs])){
            //console.log('not valid stuff in outcomeplots',props);
        }else{
            
            const sim = props.sim;
            const altSim = props.altSim;
            const survivalCurves = sim['survival_curves'];
            const altCurves = altSim['survival_curves'];
            const times = survivalCurves.times;
            const timeIdxList = timePoints.map(t => times.indexOf(t)).filter(idx => idx >= 0);
            const lineColors = sim.currDecision >= .5? [constants.dnnColor,constants.dnnColorNo,constants.knnColor,constants.knnColorNo]: [constants.dnnColorNo,constants.dnnColor,constants.knnColorNo,constants.knnColor];
            
            function drawKiviatCurve(centerX, centerY, radius, variables, colors,selector,groupNames,varNames,scales){
                //I'm assuming varaibles is a list of a list of variables, each of leng nvariables
                const radiusScale = d3.scaleSymlog()
                    .domain([0,1]).range([radius/10,radius]);
                const thetaScale = d3.scaleLinear()
                    .domain([0,variables[0].length])
                    .range([Math.PI/2,2.5*Math.PI]);

                const g = svg.selectAll('.'+selector+'Group').empty()? svg.append('g').attr('class',selector+'Group'): svg.selectAll('.'+selector+'Group');
                var paths = [];
                var labelData = [];
                for(let idx in variables){
                    let vals= variables[idx];
                    if(vals === undefined || Utils.sum(vals) == 0){
                        continue
                    }
                    let plotvals = vals;
                    if(scales !== undefined && scales[idx] !== undefined){
                        plotvals = plotvals.map(d => scales[idx](d));
                    }
                    let path = [];
                    let radii = [];
                    let thetai = [];
                    for(let idx2 in vals){
                        let r = radiusScale(plotvals[idx2]);
                        let theta = thetaScale(idx2);
                        radii.push(r);
                        thetai.push(theta)
                        let [x,y] = radToCartesian(r,theta,centerX,centerY);
                        path.push([x,y]);
                        if(Number(idx) <= .0001 && varNames !== undefined){
                            let [xText,yText] = radToCartesian(r*.9,theta,centerX,centerY);
                            labelData.push({
                                'x': xText,
                                'y': yText,
                                'text': varNames[idx2],
                            })
                        }
                        
                    }
                    path.push(path[0]);
                    paths.push({
                        'path':d3.line().curve(d3.curveCardinal.tension(.8))(path),
                        'pathPoints': path,
                        'color': colors[idx],
                        'vals': vals, 
                        'radii': radii,
                        'thetas': thetai,
                        'active': Number(idx)%2 === 1,
                    })
                }

                

                function getClass(d){
                    let c = selector;
                    if(d.active){ c += ' active'}
                    return c
                }
                const pathGroup = g.selectAll('path').filter('.'+selector).data(paths);
                pathGroup.enter()
                    .append('path').attr('class',getClass)
                    .merge(pathGroup)
                    .transition(100)
                    .attr('d',d=>d.path)
                    // .attr('fill',(d,i) => i==0? 'none':d.color)
                    // .attr('stroke',(d,i) => i==0? d.color:'none')
                    // .attr('stroke-width',2)
                    // .attr('fill-opacity',(d,i) => i == 0? 0:.25)
                    .attr('stroke',d=>d.color)
                    .attr('stroke-width',(d,i) => i==0?2:4)
                    .attr('stroke-opacity',.8)
                    .attr('fill','white')
                    .attr('fill-opacity',0);
                    pathGroup.exit().remove();

                const title = Utils.getFeatureDisplayName(selector.replace('-',' '));
                const titleSize = Math.min(20,bottomMargin/1.75);
                g.selectAll('text').filter('.'+selector+'title').remove();
                g.append('text').attr('class',selector+'title')
                    .attr('x', centerX).attr('y',height - bottomMargin/2)
                    .attr('font-size',titleSize)
                    .attr('text-anchor','middle')
                    .attr('dominant-baseline','middle')
                    .attr('textLength',title.length*titleSize  > 1.8*radius? 1.8*radius:'')
                    .attr('lengthAdjust','spacingAndGlyphs')
                    .text(title);


                g.on('mouseover',function(e,d){
                    var string = selector;
                    if(groupNames !== undefined && varNames !== undefined){
                        for(let gidx in groupNames){
                            gidx = Number(gidx);
                            if(gidx === 0 || variables[gidx] === undefined){continue}
                            let gname = Utils.getFeatureDisplayName(groupNames[gidx]);
                            string += '</br>' + gname + ':</br>'
                            for(let vidx in varNames){
                                if(variables[gidx][vidx] !== undefined){
                                    let varname = Utils.getFeatureDisplayName(varNames[vidx]);
                                    string += varname + ': ' + variables[gidx][vidx].toFixed(2) + '</br>';
                                } else{
                                    console.log('what',gname,vidx,variables[gidx][vidx])
                                }
                            }
                        }
                    }
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });
                //raise recommended outcome to top
                g.selectAll('.active').raise();

                //draw labels, doing this last so they're on top
                if(labelData.length > 0){
                    var labels = g.selectAll('text').filter('.'+selector+'tick').data(labelData);
                    const labelSize = Math.max(12,titleSize/3);
                    labels.enter().append('text')
                        .attr('class',selector+'tick')
                        .attr('x',d=>d.x).attr('y',d=>Math.max(labelSize/2,d.y))
                        .attr('text-anchor','middle')
                        .attr('dominant-baseline','middle')
                        .attr('font-size',labelSize)
                        .attr('font-weight','bold')
                        .attr('stroke','white').attr('stroke-width',.03)
                        .text(d=>getTickText(d.text));
                    labels.exit().remove();
                    labels.raise();
                } else{
                    g.selectAll('text').filter('.'+selector+'tick').remove();
                }
            }
            const nPlots = Object.values(outcomeGroups).length + (timePoints.length-1);
            const pradius = Math.min((height - topMargin - bottomMargin)/2, .5*(((width - 2*xMargin)/nPlots) - chartSpacing));
            var currCX = xMargin + pradius;

            for(const [k,v] of Object.entries(outcomeGroups)){
                const outline = v.map(d => 1);
                if(k == 'temporal'){ 
                    for(let tIdx of timeIdxList){
                        let kvals = v.map(vname => survivalCurves[vname][tIdx]);
                        let altvals = v.map(vname => altCurves[vname][tIdx]);
                        const valList = [outline,kvals,altvals]
                        const name = 'survival-'+times[tIdx]+'-Months'
                        drawKiviatCurve(currCX,(height - bottomMargin + topMargin)/2,pradius,valList,
                        ['grey'].concat(lineColors),name,['outline','treatment (model)','no treatment (model)'],v);
                        currCX += 2*pradius + chartSpacing;
                    }
                }
                else{
                    const kVals = sim[k];
                    const altvals = altSim[k];
                    const nCurveVals = v.map(vname => props.neighbors.map(d => d[vname]));
                    const nMeans = nCurveVals.map(Utils.mean);
                    const cfCurveVals = v.map(vname => props.cfs.map(d => d[vname]));
                    const cfMeans = cfCurveVals.map(Utils.mean);
                    const valList = [outline,kVals,altvals,nMeans,cfMeans];
                    drawKiviatCurve(currCX,(height - bottomMargin + topMargin)/2,pradius,valList,
                        ['grey'].concat(lineColors),k,['outline','treatment (model)','no treatment (model)','treatment (cohort)','no treatment (cohort)'],v);
                    currCX += 2*pradius + chartSpacing;
                }
                
            }
        }
    },[props.sim,props.altSim,props.neighbors,props.cfs,props.currState,svg,outcomeGroups])

    const className = props.className? props.className:'';
    return (
        <div
            className={"d3-component " + className}
            style={{'height':'95%','width':'95%','overflowY':'scroll'}}
            ref={d3Container}
        ></div>
    );
}