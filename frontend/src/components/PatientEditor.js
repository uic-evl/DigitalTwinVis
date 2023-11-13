import React, {useState, useEffect, useRef, useMemo} from 'react';
import Utils from '../modules/Utils.js';
import useWindowSize from './useWindowSize.js'
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import PatientFeatureEditor from './PatientFeatureEditor.js';
import { Input,Spinner } from '@chakra-ui/react';

function getProgressionVars(state){
    var vars = [];
    if(state > 0){
        vars = Object.keys(constants.progressionVars).filter(d=>d.includes('IC'));
        if(state > 1){
            vars = vars.concat(Object.keys(constants.progressionVars).filter(d=>d.includes('CC')))
        }
    }
    return vars
}

export default function PatientEditor(props){

    const container = useRef(null);
    const wSize = useWindowSize();

    const [height,width] = useMemo(()=>{
        if(container.current !== null){
            const h = container.current.clientHeight;
            const w = container.current.clientWidth;
            return [h,w]
        } else{
            return [0,0]
        }
    },[container,wSize]);

    const [patientViews,setPatientViews] = useState(<Spinner></Spinner>);

    const [, updateState] = React.useState();
    const forceUpdate = React.useCallback(() => updateState({}), []);

    const topMargin = Math.min(height/15,60);
    const bottomMargin = 40;
    const xMargin = 40;
    const textSpacing = 0;

    const ordinalVars = constants.ordinalVars;
    const booleanVars = constants.booleanVars.filter(d=>!d.includes('subsite'));
    const continuousVars = constants.continuousVars;

    const allVars = Object.keys(ordinalVars)
    .concat(continuousVars)
    .concat(booleanVars)
    .concat(getProgressionVars(props.currState));
    // .concat(['placeholder'])
    // .concat(constants.DECISIONS);
    // .concat(['placeholder2'])
    // .concat(constants.OUTCOMES);

    const xRange = [textSpacing+xMargin,width-xMargin];
    
    const yScale = d3.scaleLinear()
            .domain([0,allVars.length-1])
            .range([height-bottomMargin,topMargin]);

    const lineSpacing = Math.abs(yScale(1) - yScale(0));

    function getSim(){
        //get simulation but inside call so it doesn't break the drag stuff
            if(!Utils.allValid([props.simulation,props.modelOutput,props.fixedDecisions])){return undefined}
            if(props.simulation[props.modelOutput] === undefined){return undefined}
            let key = props.modelOutput;
            let allFixed = true;
            for(let i in props.fixedDecisions){
                let d = props.fixedDecisions[i];
                let di = parseInt(i) + 1
                if(d >= 0){
                let suffix = '_decision'+(di)+'-'+d;
                key += suffix;
                } else{
                    allFixed = false;
                }
            }
            //note: this was before I changed it to only do the current model in the api call to save time
            //I only saved 'optimal' if all are fixed to avoid repitition for when all decisions are fixed since its the same
            // if(allFixed){
            //     key = key.replace('imitation','optimal')
            // }
            return props.simulation[key]
        }

    function getY(key){
        let pos = allVars.indexOf(key);
        if(pos < 0){
            console.log('bad x key',key,allVars);
        }
        return yScale(pos);
    }

    const getRadius = (id)=>{
        if(id === -1){
            return Math.min(lineSpacing/4,20);
        }
        return 7;
    }

    function makeScales(cData){
        var scales = {};
        var means = {};
        const range = xRange;
        for(const [key,entry] of Object.entries(ordinalVars)){
            if(allVars.indexOf(key) < 0){ continue; }
            scales[key] = d3.scaleLinear()
                .domain([entry[0],entry[entry.length-1]])
                .range(range);
        }
        let pVals = Object.values(cData);
        for(const key of continuousVars){
            if(allVars.indexOf(key) < 0){ continue; }
            let vals = pVals.map(d=>d[key]);
            scales[key] = d3.scaleLinear()
                .domain(d3.extent(vals))
                .range(range);
            means[key] = d3.median(vals);
        }
        for(const key of booleanVars.concat(constants.DECISIONS).concat(constants.OUTCOMES)){
            if(allVars.indexOf(key) < 0){ continue; }
            scales[key] = d3.scaleLinear()
                .domain([0,1])
                .range(range);
            means[key] = 0
        }
        for(const [key,entry] of Object.entries(constants.progressionVars)){
            const s = d3.scaleLinear()
                .domain([0,entry.length - 1])
                .range(xRange);
            scales[key] = s;
        }
        return [scales, means]
    }

    function encodeOrdinal(p,key,values){
        //maps onehot encoded ordinal values to a discrete integer
        //defaults to lowest value -1 if missing or invalid 
        //if no keys of the rigth name are there it returns null so we know to do "all zero" vs "not there"
        let val = values[0]-1;
        let isMissing=true;
        for(let i of values){
            //check if there are actually values here
            if(p[key+'_'+i] !== undefined){
                isMissing=false
            }
            if(p[key+'_'+i] > 0){
                val = i;
                break;
            }
        }
        if(isMissing){
            return null
        }
        return val
    }

    function unencodeOrdinal(key){
        const vals = [0,1,2,3,4,5,6,7,8,9];
        for(let val of vals){
            key = key.replace('_'+val,'')
        }
        return key
    }

    function encodeFeatureQue(p){
        let values = {}
        for(const [key,v] of Object.entries(ordinalVars)){
            let val = encodeOrdinal(p,key,v);
            if(val !== null){
                values[key] = val
            }
        }
        for(const [key,vList] of Object.entries(constants.progressionVars)){
            for(let i in vList){
                i = parseInt(i);
                let name = vList[i];
                if(p[name] > .5){
                    values[key] = i;
                    break
                }
            }
        }
        for(const [key,v] of Object.entries(p)){
            if(constants.progressionVars[key] !== undefined){continue}
            if(ordinalVars[unencodeOrdinal(key)] === undefined){
                values[key] = v;
            }
        }
        return values
    }

    function encodePatient(p,isSimulated=false,meanVals){
        let values = {}
        for(const [key,v] of Object.entries(ordinalVars)){
            values[key] = encodeOrdinal(p,key,v);
        }
        for(let key of continuousVars){
            let val = p[key] === undefined? (meanVals === undefined? 0: meanVals[key]):p[key];
            values[key] = val;
        }
        for(let key of booleanVars){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        for(let key of constants.DECISIONS){
            if(isSimulated){
                let loc = constants.DECISIONS.indexOf(key);
                let decision = getSim()['decision'+(loc+1)];
                values[key] = decision;
            } else{
                let val = p[key] === undefined? 0:p[key] > .5;
                values[key] = val;
            }
        }
        for(let key of constants.OUTCOMES){
            if(isSimulated){
                let loc = constants.OUTCOMES.indexOf(key);
                let outcome = getSim()['outcomes'][loc];
                values[key] = outcome;
            } else{
                let val = p[key] === undefined? 0:p[key];
                values[key] = val;
            }
        }
        for(let [key,entry] of Object.entries(constants.progressionVars)){
            let i = 0;
            let val = -1;
            let currPct = 0;
            for(let n of entry){
                if(p[n] > currPct){
                    val = i;
                    currPct = p[n];
                }
                i+=1
            }
            if(val < 0){
                val = 0;
            }
            values[key] = val;
        }
        return values;
    }

    //For some reason setting the feature que here doesn't tirgger and update so I call draw explicity
    function handleFeatureInput(e,n){
        if(e.target.nodeName=== 'INPUT' & e.keyCode === 13){
            var value = e.target.value;
            if(value === '' | value === null | value === undefined){
                return;
            }
            if(constants.continuousVars.indexOf(n) > -1){
                if(isNaN(Number(value))){ return; }
                var newQ = Object.assign(props.featureQue);
                newQ[n] = Number(value);
                props.setFeatureQue(newQ);
                draw()
            } else if(constants.booleanVars.indexOf(n) > -1){
                value = value === 'Y'? 1:value;
                value = value === 'N'? 0: value;
                value = parseInt(value);
                if(value !== 0 & value !== 1){ return; }
                var newQ = Object.assign(props.featureQue);
                newQ[n] = parseInt(value);
                props.setFeatureQue(newQ);
                draw();
            } else if(constants.ordinalVars[n] !== undefined){
                let validVals  = constants.ordinalVars[n];
                value = parseInt(value);
                if(validVals.indexOf(value) < 0){return}
                var newQ = Object.assign(props.featureQue);
                for(let v of constants.ordinalVars[n]){
                    newQ[n+'_'+v] = (value === parseInt(v)) + 0;
                }
                props.setFeatureQue(newQ);
                draw();
            } else if(constants.progressionVars[n] !== undefined){
                let validVals = constants.progressionVars[n];
                let entry = validVals[parseInt(value)];
                if(entry === undefined){
                    value = ['PD','SD','PR','CR'].indexOf(value);
                    if(value < 0){return}
                }
                var newQ = Object.assign(props.featureQue);
                for(let i in validVals){
                    i = parseInt(i);
                    newQ[validVals[i]] = (i === parseInt(value)) + 0
                }
                props.setFeatureQue(newQ);
                draw();
            }
        }
    }

    function draw(){
        if(!Utils.allValid([
            props.patientFeatures,
            props.simulation,
            props.cohortData])){
                return
            }
        if(props.simulation[props.modelOutput] === undefined){ return }
        let [s,means] = makeScales(props.cohortData);
        //quick correction to adapt vestigial code
        const meanVals = means;

        //new stuff
        const mainPatient = encodePatient(props.patientFeatures,true,meanVals);
        const encodedQue = encodeFeatureQue(props.featureQue);
        const simResults = props.simulation[props.modelOutput];
        const attention = simResults['decision'+(props.currState+1)+'_attention'];

        const attentionScale = Utils.getColorScale('attributions',attention.range[0],attention.range[1]);

        function getAttention(key){
            let aVal = 0;
            if(ordinalVars[key] !== undefined){
                let vals = ordinalVars[key];
                let keys = vals.map(i => key + '_' + i);
                for(let key of keys){
                    aVal += attention.baseline[key];
                }
            } 
            //ok so this is actually the attentio nof the simulated stuff currently so changing it doesn't affect anything idk
            else if(constants.progressionVars[key] !== undefined){
                if(key.includes('Primary')){
                    for(let [name,pdVal] of Object.entries(attention.pd)){
                        aVal += pdVal;
                    }
                } else{
                    for(let [name,ndVal] of Object.entries(attention.nd)){
                        aVal += ndVal;
                    }
                }
                return aVal
            }
            else{
                aVal = attention.baseline[key];
            }
            return aVal
        }

        //axes and stuff
        const axes = [];
        const markers = [];
        for(const [key,scale] of Object.entries(s)){
            if(allVars.indexOf(key) < 0){
                continue;
            }
            let x0 = xRange[0];
            let x1 = xRange[1];
            let y0 = getY(key);
            let y1 = getY(key);
            let line = d3.line()([[x0,y0],[x1,y1]]);
            axes.push({
                'path': line,
                'name': key,
                'domain': scale.domain(),
                'xText':(x0 + x1)/2,
                'yText': y0 - getRadius(-1) - 6,
            })
            let xTicks = [0,1];
            if(ordinalVars[key] !== undefined){
                xTicks= constants.ordinalVars[key];
            } else if(continuousVars.indexOf(key) > -1){
                //todo: add exact values for certain continous values here idk
                if(constants.contVarGroups[key] !== undefined){
                    xTicks = constants.contVarGroups[key]
                } else{
                    const [minVal,maxVal] = scale.domain();
                    let weights = key === 'hpv'? [0,.5,1]: [0,.25,.5,.75,1];
                    xTicks = weights.map(w => maxVal*w + (minVal*(1-w))).map(i=> parseFloat(i));
                }
            } else if(constants.progressionVars[key] !== undefined){
                xTicks = constants.progressionVars[key].map((d,i)=>i);;
            }
            markers.push({
                'name': key,
                'ticks': xTicks,
                'scale': scale,
                'currValue': mainPatient[key],
                'attention':getAttention(key),//todo:see if this works?
                'attentionColor': attentionScale(getAttention(key)),
            })

        }


        function makeEditorRow(data,i){
            return (
            <div  key={i+data.name+props.featureQue[data.name]} style={{'height':'3em','width':'100%','marginTop':'.1em'}}>
                <div style={{'width':'100%','height':'1.3em','margin':'0px'}}>
                    <div className={'centerText'} style={{'display':'inline-flex','width':'100%','height':'100%','fontSize':'.8em','fontWeight':'bold'}}>
                        {Utils.getFeatureDisplayName(data.name)}
                        <svg style={{'width':'1em','height':'100%','marginTop':'.1em'}}>
                            <circle 
                            fill={data.attentionColor}
                            r={'.5em'}
                            cy={'50%'}
                            cx={'50%'}
                            />
                        </svg>
                    </div>
                </div>
                <div style={{'display':'flex','height': 'calc(100% - 1em)','width':'100%'}}>
                    <div style={{'display':'inline-flex','height':'100%','width':'calc(100% - 3em)'}}> 
                        <PatientFeatureEditor 
                            data={data} key={data.name} 
                            patientData={mainPatient}
                            attention={attention} 
                            simResults={simResults}
                            updatePatient={props.updatePatient}
                            patientFeatures={props.patientFeatures}
                            featureQue={props.featureQue}
                            encodedFeatureQue={encodedQue}
                            unencodeOrdinal={unencodeOrdinal}
                            setPatientFeatures={props.setPatientFeatures}
                            setFeatureQue={props.setFeatureQue}
                        />
                    </div>
                    <div style={{'display':'inline-flex','width':'4rem','height':'100%','marginTop':'0px'}}>
                        <Input 
                            placeholder={data.currValue? data.currValue.toString(): 0} 
                            className={'fillSpace'} 
                            variant='outline'
                            onKeyDown={(e)=>handleFeatureInput(e,data.name)}
                            defaultValue={props.featureQue[data.currValue]}
                        />
                    </div>
                </div>
            </div>
            )
        }

        const views = markers.map((d,i)=>makeEditorRow(d,i));
        setPatientViews(views);
    };

    useEffect(()=>{
        draw();
    },[props.cohortData,
        props.currState,
        props.patientFeatures,
        props.simulation,
        props.featureQue,
        // allVars,
        props.fixedDecisions,
        props.modelOutput]) 



    return (
        <div 
            ref={container}
            style={{'height':'auto','width':'100%'}}
        >{patientViews}</div>
    );
}