const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const yaml = require('js-yaml');

function Cf(value){
    this.value = value;
}

function SequenceCf(value) {
    this.value = value;
    this.toString = () => {
        return "["+this.value.reduce((acc, v) => acc? acc + ", " + v: v, "") + "]"
    };
}

const cfOptions = {
    kind: 'scalar',
    resolve: function (data) {
        return data !== null;
    },
    construct: function (data) {
        return new Cf(data);
    },
    instanceOf: Cf,
    represent: function (cf) {
        return cf.value;
    }
}

const sequenceOptions = {
    kind: 'sequence',
    resolve: function (data) {
        return data !== null;
    },
    construct: function (data) {
        return new SequenceCf(data);
    },
    instanceOf: SequenceCf,
    represent: function (sequenceCf) {
        return sequenceCf.value;
    }
}

const RefYamlType = new yaml.Type('!Ref', cfOptions);
const SubYamlType = new yaml.Type('!Sub', cfOptions);
const GetAttYamlType = new yaml.Type('!GetAtt', cfOptions);
const FindInMapType = new yaml.Type('!FindInMap', sequenceOptions);
const EqualsType = new yaml.Type('!Equals', sequenceOptions);
const IfType = new yaml.Type('!If', sequenceOptions);

const AWS_CF_SCHEMA = yaml.DEFAULT_SCHEMA.extend([RefYamlType, SubYamlType, GetAttYamlType, FindInMapType, EqualsType, IfType]);

const filesToProcess = [];
const templateFiles = [];

templateFiles.push(path.resolve(__dirname, 'template.yaml'));

while(templateFiles.length > 0) {
    const templateFile = templateFiles.pop();
    filesToProcess.unshift(templateFile)
    const templateFileContents = fs.readFileSync(templateFile, 'utf8');
    const Template = yaml.load(templateFileContents, {schema: AWS_CF_SCHEMA});
    for(const ResourceName in Template.Resources) {
        const Resource = Template.Resources[ResourceName];
        if(Resource.Type === 'AWS::Serverless::Application') {
            const dirname = path.dirname(templateFile);
            templateFiles.push(path.resolve(dirname, Resource.Properties.Location));
        }
    }
}

let promise = Promise.resolve();

for(const fileToProcess of filesToProcess){
    const buildPromise = () => new Promise((resolve, reject) => {
        const dirname = path.dirname(fileToProcess);
        const buildMessage = `Building ${dirname}`;
        console.log(`\n\n`);
        const hashArray = [];
        for(let i = 0; i < buildMessage.length; i++){
            hashArray.push('#');
        }
        console.log(hashArray.join(''));
        console.log(buildMessage);
        const samBuild = spawn('sam', ['build'], {cwd: dirname});
        samBuild.stdout.on("data", data => {
            console.info(data.toString());
        });

        samBuild.stderr.on("data", data => {
            console.error(data.toString());
        });

        samBuild.on('error', (error) => {
            const message = `error: ${error.message}`;
            console.error(message);
            reject(message);
        });

        samBuild.on("close", code => {
            if(code === 0){
                resolve(dirname);
            } else {
                reject(`Build process failed with code ${code}`);
            }
        });
    });

    const transformPromise = (dirname) => new Promise((resolve, reject) => {
        const templateLocation = path.join(dirname, '.aws-sam', 'build', 'template.yaml');
        console.info(`Transforming built module ${dirname}: ${templateLocation}`);
        try{
            const templateFileContents = fs.readFileSync(templateLocation, 'utf8');
            const Template = yaml.load(templateFileContents, {schema: AWS_CF_SCHEMA});
            for(const ResourceName in Template.Resources) {
                const Resource = Template.Resources[ResourceName];
                if(Resource.Type === 'AWS::Serverless::Application') {
                    const OldLocation = Resource.Properties.Location;
                    Resource.Properties.Location = `${Resource.Properties.Location}`.replace(/template.yaml$/, path.join('.aws-sam', 'build', 'template.yaml'))
                    console.log(`Transformed ${ResourceName} from ${OldLocation} to ${Resource.Properties.Location}`);
                }
            }
            const updatedTemplate = yaml.dump(Template,{
                schema: AWS_CF_SCHEMA
            });

            fs.writeFileSync(templateLocation, updatedTemplate.replace(/T00\:00\:00\.000Z/g,''));
            console.info(`Wrote transformed template location: ${templateLocation}`);
            resolve();
        } catch(e) {
            reject(`Couldn't transform built module ${dirname}: ${e}`);
        }

    });
    promise = promise.then(buildPromise).then(transformPromise);
}

(async() => {
    await promise;
})();
