import React, {useState, useEffect, useRef,useMemo} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function OutcomePlots(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    
    const margin = 10;
    const labelSpacing = 60;
    const titleSpacing = Math.max(height*.04,30);
    const modelSpacing = 5;
    const outcomeSpacing = 10;

    const mainPatientOutcomes=['OS (Calculated)(4yr)','FT','Aspiration rate Post-therapy','Locoregional control (Time)(4yr)']
    const xScale = useMemo(()=>{
        return d3.scaleLinear()
            .domain([0,1])
            .range([margin+labelSpacing, width- 2*margin - labelSpacing])
    },[width])

    //get dict of the keys in the simulation results and the corresponding file names for neigbhor stuff
    const simStates = useMemo(()=>{
        var keys = {'outcomes': constants.OUTCOMES};
        if(props.state === 0){
            keys['pd1'] = constants.primaryDiseaseProgressions;
            keys['nd1'] = constants.nodalDiseaseProgressions;
            keys['dlt1'] = constants.dlts1;
        } else if(props.state === 1){
            keys['pd2'] = constants.primaryDiseaseProgressions2;
            keys['nd2'] = constants.nodalDiseaseProgressions2;
            keys['dlt2'] = constants.dlts2;
        }
        if(props.state < 2){
            var toDel = [];
            if(props.outcomesView === 'disease response'){
                toDel = ['dlt1','dlt2','outcomes'];
            } else if(props.outcomesView === 'dlts'){
                toDel = ['pd1','nd1','pd2','nd2','outcomes'];
            } else if(props.outcomesView === 'no dlts'){
                toDel = ['dlt1','dlt2'];
            } else if(props.outcomesView === 'endpoints'){
                toDel = ['pd1','nd1','pd2','nd2','dlt1','dlt2'];
            }
            for(let d of toDel){
                delete keys[d];
            }
        }
        return keys;
        
    },[props.state,props.outcomesView]);

    useEffect(()=>{
        if(!Utils.allValid([svg,props.sim,props.altSim,props.neighborOutcomes,props.counterfactualOutcomes])){
            //console.log('not valid stuff in outcomeplots',props.sim,props.altSim,props.neighborOutcomes,props.counterfactualOutcomes);
        }else{
            var nBars = 0;
            var nOutcomes = 0;
            for(let [key,entry] of Object.entries(simStates)){
                nBars += 4*entry.length;
                nOutcomes+= entry.length;
            }
            //what width it would need to be to actually fit everything, in the worst case (CC)
            //I actually still cant get this to work good but also it never fits anyway
            const idealBarWidth = (height -  2*margin - titleSpacing - (4)*outcomeSpacing - nOutcomes*modelSpacing)/nBars;
            const barWidth = Math.max(Math.min(idealBarWidth,20),10);
            var pos = margin+titleSpacing;
            var rectData = [];
            var titles = [];
            var pathPoints = [];
            function increment(val,increment=0){
                pos += barWidth + increment;
            }
            const treatment = props.mainDecision > 0? props.sim: props.altSim;
            const noTreatment =  props.mainDecision > 0? props.altSim: props.sim;
            for(let [key,entry] of Object.entries(simStates)){
                let probs = treatment[key];
                let altProbs = noTreatment[key];
                let probsLower = treatment[key+'_5%'];
                let probsUpper = treatment[key+'_95%'];
                let altProbsLower= noTreatment[key+'_5%'];
                let altProbsUpper = noTreatment[key+'_95%'];
                let nProbs = entry.map(e => props.neighborOutcomes[e]);
                let cfProbs = entry.map(e => props.counterfactualOutcomes[e]);
                let titleEntry = {
                    'y': pos - .5*barWidth,
                    'text': key,
                }
                titles.push(titleEntry);
                for(let ii in entry){
                    let newPath = [[margin+labelSpacing,pos]];

                    let name = entry[ii];

                    rectData.push({
                        'name': name,
                        'model':'treatment',
                        'val': probs[ii],
                        'altVal': altProbs[ii],
                        'lower': probsLower[ii],
                        'upper': probsUpper[ii],
                        'y': pos,
                        'rnn': true,
                        'first':true,
                    });
                    
                    increment(probs[ii]);

                    rectData.push({
                        'name': name,
                        'model':'noTreatment',
                        'val': altProbs[ii],
                        'altVal': probs[ii],
                        'lower': altProbsLower[ii],
                        'upper': altProbsUpper[ii],
                        'y': pos,
                        'rnn': true,
                        'first':false,
                    });

                    increment(altProbs[ii]);

                    pos += modelSpacing;

                    var simEntry = {
                            'name': name,
                            'model':'similar',
                            'val': nProbs[ii],
                            'altVal': cfProbs[ii],
                            'y': pos,
                            'rnn': false,
                            'first':false,
                    }
            
                    var cfEntry = {
                        'name': name,
                        'model':'counterfactuals',
                        'val': cfProbs[ii],
                        'altVal': nProbs[ii],
                        'y': pos,
                        'rnn': false,
                        'first':false,
                    }

                
                    if(props.mainDecision){
                        rectData.push(simEntry);
                        increment(nProbs[ii]);
                        cfEntry.y=pos;
                        rectData.push(cfEntry);
                        increment(cfProbs[ii]);
                    } else{
                        rectData.push(cfEntry);
                        increment(cfProbs[ii]);
                        simEntry.y=pos;
                        rectData.push(simEntry);
                        increment(nProbs[ii]);
                    }


                    newPath.push([margin+labelSpacing,pos]);
        
                    pos += Math.max(outcomeSpacing, 5+barWidth);
                    pathPoints.push(newPath);
                }
        
                pos += outcomeSpacing;
            }

            //this is coded to orient as recommened vs not recommeneded
            //but this basically just converts it to treated = yes vs no treated for coloring
            
            const noTreatmentModels = props.mainDecision > 0.001? ['noTreatment','counterfactuals']: ['noTreatment','similar'];
            const isTreatment = d => noTreatmentModels.indexOf(d.model) < 0;
            function getFill(d){
                if(!isTreatment(d)){
                    return d.rnn? constants.dnnColorNo: constants.knnColorNo;
                }
                return d.rnn? constants.dnnColor: constants.knnColor;
            }

            function getStrokeWidth(d){
                if(!isTreatment(d)){
                    return 1;
                }
                return 0;
            }

            function getOpacity(d){
                return .8;
                if(!isTreatment(d)){
                    return 1;
                }
                return .5;
            }

            const rects = svg.selectAll('.rect').data(rectData,d=> d.name + d.model);
            rects.enter().append('rect')
                .attr('class',d=> isTreatment(d)? 'rect': 'rect activeRect')
                .merge(rects)
                .attr('height',(barWidth-2))
                .attr('fill',getFill)
                .attr('stroke','black')
                .attr('stroke-width',getStrokeWidth)
                .attr('opacity',getOpacity)
                .attr('x',xScale(0))
                .transition(1000)
                .attr('y',d=>d.y)
                .attr('width',d=>xScale(d.val)-xScale(0))
                
            rects.on('mouseover',function(e,d){
                    const string = d.name + '</br>' + d.model + '</br>' + d.val.toFixed(4);
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

            rects.exit().remove();
            svg.selectAll('.error').remove();
            const eLineFunc = d3.line()
                .x(d=> xScale(d[0]));

            function getErrorPath(d){
                let p1 = [Math.min(d.val,d.lower),d.y+barWidth/2];
                let p2 = [Math.max(d.val,d.upper), d.y+barWidth/2];
                return eLineFunc([p1,p2]);
            }
            svg.selectAll('.error').data(rectData.filter(d=>d.rnn),d=> d.name + d.model)
                .enter().append('path')
                .attr('class','error')
                .attr('d',getErrorPath)
                .attr('fill','none')
                .attr('stroke','black')
                .attr('stroke-width',3)
                .attr('opacity',1);

            // svg.selectAll('.rnn').remove();
            // svg.selectAll('.rnn').data(rectData,d=> d.name + d.model)
            //     .enter().append('circle')
            //     .attr('class',d=> isTreatment(d)? 'rnn': 'rnn activeRnn')
            //     .attr('cx',d=>xScale(d.val))
            //     .attr('cy',d=>d.y+barWidth/2)
            //     .attr('r',barWidth/2)
            //     .attr('fill',getFill)
            //     .attr('stroke','black')
            //     .attr('stroke-width',getStrokeWidth)
            //     .attr('opacity',getOpacity)
            //     .on('mouseover',function(e,d){
            //         const string = d.name + '</br>' + d.model + '</br>' + d.val.toFixed(4);
            //         tTip.html(string);
            //     }).on('mousemove', function(e){
            //         Utils.moveTTipEvent(tTip,e);
            //     }).on('mouseout', function(e){
            //         Utils.hideTTip(tTip);
            //     });
    

            svg.selectAll('.line').remove();
            svg.selectAll('path').filter('.line')
                .data(pathPoints)
                .enter().append('path')
                .attr('class','line')
                .attr('d',d=>d3.line()(d))
                .attr('stroke','grey')
                .attr('stroke-width',2);

            svg.selectAll('text').remove();
            svg.selectAll('.titles').data(titles)
                .enter().append('text')
                .attr('class','titles')
                .attr('text-anchor','middle')
                .attr('y',d=>d.y)
                .attr('x',width/2)
                .attr('font-size',barWidth)
                .attr('font-weight','bold')
                .text(d=>Utils.getFeatureDisplayName(d.text));

            function fixName(d){
                let string = d.replace(' Primary','').replace(' Nodal','').replace('DLT_','').replace(' 2','').replace('(Pneumonia)','');
                return Utils.getVarDisplayName(string)
            }

            svg.selectAll('.labels').remove();
            svg.selectAll('.labels')
                .data(rectData.filter(d=> d.first))
                .enter().append('text')
                .attr('class','labels')
                .attr('text-anchor','end')
                .attr('text-align','top')
                .attr('y',(d,i) => (barWidth+pathPoints[i][0][1] + pathPoints[i][1][1])/2)
                .attr('x',labelSpacing)
                .attr('font-size',barWidth)
                .attr('textLength',d=> fixName(d.name).length > 6? labelSpacing*.9: '')
                .attr('lengthAdjust','spacingAndGlyphs')
                .text(d=>fixName(d.name));
            
            function getLabelX(d){
                let edge1 = d.upper === undefined? d.val:d.upper;
                const higherVal = Math.max(d.altVal,edge1);
                const x = xScale(higherVal) + 10;
                return x;
            }


            const getLabelText = d => (100*d.val).toFixed(1) + '%'
            svg.selectAll('.valLabels')
                .data(rectData.filter(d=>d.val > 0))
                .enter().append('text')
                .attr('class','valLabels')
                .attr('text-anchor','start')
                .attr('y',d=>d.y+barWidth*.75)
                .attr('font-weight','bold')
                .attr('stroke','white')
                .attr('stroke-width',.01)
                .attr('x',getLabelX)
                .attr('font-size',barWidth*.9)
                .attr('lengthAdjust','spacingAndGlyphs')
                .text(getLabelText);

            // var decisionName = constants.DECISIONS_SHORT[props.state];
            // var legendData = [];
            // let ii = 0;
            // // pos -= 2*barWidth;
            // let lBarHeight = ((titleSpacing-10)/2) - topMargin;
            // for(let model of ['model','neighbors']){
            //     for(let treated of [true,false]){
            //         let color = treated? constants.dnnColor: constants.dnnColorNo;
            //         let xPos = model === 'model'? margin: width/2;
            //         let yPos = treated? margin: margin + lBarHeight + 4;
            //         if( model === 'neighbors'){
            //             color = treated? constants.knnColor: constants.knnColorNo;
            //         }
            //         let text = decisionName + ' (' + model + ' pred.)';
            //         text = treated? text: 'No '+text;
            //         let strokeWidth = treated? 0: 1;
            //         let entry = {
            //             'fill': color,
            //             'text': text,
            //             'y': yPos,
            //             'x': xPos,
            //             'strokeWidth': strokeWidth,
            //         }
            //         legendData.push(entry);
            //     }
            // }

            // svg.selectAll(".legend").remove();
            // svg.selectAll('legendText').remove();
            // svg.selectAll('.legend')
            //     .data(legendData).enter()
            //     .append('rect').attr('class','legend')
            //     .attr('x',d=>d.x)
            //     .attr('y',d=>d.y)
            //     .attr('width',lBarHeight)
            //     .attr('height',lBarHeight)
            //     .attr('fill',d=>d.fill)
            //     .attr('stroke','black')
            //     .attr('stroke-width',d=>d.strokeWidth)
                
            // svg.selectAll('.lText').data(legendData)
            //     .enter()
            //     .append('text')
            //     .attr('class','lText')
            //     .attr('x', d=> d.x + lBarHeight + 3)
            //     .attr('y',d=>d.y+lBarHeight)
            //     .attr('text-align','center')
            //     .attr('font-weight','bold')
            //     .attr('font-size',lBarHeight)
            //     .text(d=>d.text);
            //we want the outline stuff to be on top
            svg.selectAll('.activeRect').raise();
            svg.selectAll('.error').raise()
            svg.selectAll('text').raise();
            svg.attr('height',pos+10)
        }
    },[props.sim,props.altSim,props.neighborOutcomes,props.counterfactualOutcomes,simStates,svg,xScale,props.mainDecision,simStates])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%','overflowY':'scroll'}}
            ref={d3Container}
        ></div>
    );
}