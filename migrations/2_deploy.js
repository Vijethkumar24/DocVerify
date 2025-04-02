const DocumentRegistry = artifacts.require("DocumentRegistry");
module.exports = function (deployer) {
  deployer.deploy(DocumentRegistry).then((instance) => {
    console.log("Contract deployed at address:", instance.address);
  });
};
