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
    const titleSpacing = 50;
    const xScale = useMemo(()=>{
        return d3.scaleLinear()
            .domain([0,1])
            .range([0, width- 2*margin - labelSpacing])
    },[width])

    // const outcomeKey = useMemo(()=>{
    //     var outcomes = constants.OUTCOMES;
    //     if(currState == 0){
    //         outcomes = outcomes.concat(constants.dlts1);
    //         outcomes = outcomes.concat(constants.primaryDiseaseProgressions);
    //         outcomes = outcomes.concat(constants.nodalDiseaseProgressions);
    //     } else if(currState == 1){
    //         outcomes = outcomes.concat(constants.dlts2);
    //         outcomes = outcomes.concat(constants.primaryDiseaseProgressions2);
    //         outcomes = outcomes.concat(constants.nodalDiseaseProgressions2);
    //     }
    // })
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
        return keys
    },[props.state]);

    useEffect(()=>{
        if(!Utils.allValid([svg,props.sim,props.altSim,props.neighborOutcomes,props.counterfactualOutcomes])){
            //console.log('not valid stuff in outcomeplots',props.sim,props.altSim,props.neighborOutcomes,props.counterfactualOutcomes);
        }else{
            var nStates = 0;
            for(let [key,entry] of Object.entries(simStates)){
                nStates += 2.5*entry.length;
                nStates += 1;
            }
            const barWidth = Math.min(((height - margin*2 - titleSpacing)/nStates) - 2,20);
            var pos = margin+titleSpacing;
            var rectData = [];
            var titles = []
            for(let [key,entry] of Object.entries(simStates)){
                let probs = props.sim[key];
                let altProbs = props.altSim[key];
                let nProbs = entry.map(e => props.neighborOutcomes[e]);
                let cfProbs = entry.map(e => props.counterfactualOutcomes[e]);
                let titleEntry = {
                    'y': pos - .5*barWidth,
                    'text': key,
                }
                titles.push(titleEntry);
                for(let ii in entry){
                    let name = entry[ii];
                    rectData.push({
                        'name': name,
                        'model':'primary',
                        'val': probs[ii],
                        'altVal': altProbs[ii],
                        'y': pos,
                        'rnn': true,
                    });
                    // pos += barWidth;
                    rectData.push({
                        'name': name,
                        'model':'alternative',
                        'val': altProbs[ii],
                        'altVal': probs[ii],
                        'y': pos,
                        'rnn': true,
                    });

                    pos += barWidth;
                    rectData.push({
                        'name': name,
                        'model':'similar',
                        'val': nProbs[ii],
                        'altVal': cfProbs[ii],
                        'y': pos,
                        'rnn': false,
                    });
                    // pos += barWidth;
                    rectData.push({
                        'name': name,
                        'model':'counterfactuals',
                        'val': cfProbs[ii],
                        'altVal': nProbs[ii],
                        'y': pos,
                        'rnn': false
                    });
                    pos += 1.5*barWidth ;
                    
                }
                pos += barWidth;
                pos += 1*barWidth;
            }

            //this is coded to orient as recommened vs not recommeneded
            //but this basically just converts it to treated = yes vs no treated for coloring
            
            const noTreatmentModels = props.mainDecision > 0.001? ['alternative','counterfactuals']: ['primary','similar'];
            const isTreatment = d => noTreatmentModels.indexOf(d.model) < 0;
            function getFill(d){
                if(!isTreatment(d)){
                    return 'none';
                }
                return d.rnn? 'teal': 'goldenrod';
            }

            function getStrokeWidth(d){
                if(!isTreatment(d)){
                    return 3;
                }
                return 0;
            }

            function getOpacity(d){
                if(!isTreatment(d)){
                    return 1;
                }
                return .75;
            }

            svg.selectAll('.rect').remove();
            svg.selectAll('.rect').data(rectData)
                .enter().append('rect')
                .attr('class',d=> isTreatment(d)? 'rect': 'rect activeRect')
                .attr('width',d=>xScale(d.val))
                .attr('y',d=>d.y)
                .attr('height',barWidth-2)
                .attr('fill',getFill)
                .attr('stroke','black')
                .attr('stroke-width',getStrokeWidth)
                .attr('opacity',getOpacity)
                .attr('x',margin+labelSpacing)
                .on('mouseover',function(e,d){
                    const string = d.name + '</br>' + d.model + '</br>' + d.val.toFixed(4);
                    tTip.html(string);
                }).on('mousemove', function(e){
                    Utils.moveTTipEvent(tTip,e);
                }).on('mouseout', function(e){
                    Utils.hideTTip(tTip);
                });

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
            svg.selectAll('.labels').data(rectData.filter(d=>d.model==='primary'))
                .enter().append('text')
                .attr('class','labels')
                .attr('text-anchor','right')
                .attr('text-align','top')
                .attr('y',d=>d.y+barWidth)
                .attr('x',margin)
                .attr('font-size',barWidth)
                .attr('textLength',d=> fixName(d.name).length > 6? labelSpacing*.9: '')
                .attr('lengthAdjust','spacingAndGlyphs')
                .text(d=>fixName(d.name));
            
            function getLabelX(d){
                const higherVal = Math.max(d.altVal,d.val);
                let x = margin+labelSpacing;
                if(higherVal > .8){
                    x += xScale(higherVal) - 80;
                    return x;
                }
                x += xScale(higherVal) + 10;
                return x;
            }
            // const getLabelText = d => 'Y: ' + (d.val*100).toFixed(0) 
            //     + '% | N:' + (d.altVal*100).toFixed(0) + '%'
            //     + ' | Δ : ' + ((d.val - d.altVal)*100).toFixed(1) + '%';
            const getLabelText = d => (d.val > d.altVal? '+':'-') + ' ' + Math.abs((d.val - d.altVal)*100).toFixed(1) + '%';
            svg.selectAll('.valLabels')
                .data(rectData.filter(isTreatment))
                .enter().append('text')
                .attr('class','valLabels')
                .attr('text-anchor','start')
                .attr('y',d=>d.y+barWidth*.75-1)
                .attr('font-weight','bold')
                .attr('stroke','white')
                .attr('stroke-width',.01)
                .attr('x',getLabelX)
                .attr('font-size',barWidth*.75)
                .attr('lengthAdjust','spacingAndGlyphs')
                .text(getLabelText);
            //we want the outline stuff to be on top
            svg.selectAll('.activeRect').raise();
        }
    },[props.sim,props.altSim,props.neighborOutcomes,props.counterfactualOutcomes,simStates,svg,xScale,props.mainDecision])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}