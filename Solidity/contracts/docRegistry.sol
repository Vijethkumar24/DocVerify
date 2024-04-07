// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentRegistry {
    struct Document {
        bytes32 passwordHash; // Hash of user password
        bytes32 documentHash; // Hash of the document
        string ipfsHash; // IPFS hash of the document
        bool exists; // Flag to indicate existence
    }

    mapping(address => mapping(bytes32 => Document)) private userDocuments;

    // Event to log document registration
    event DocumentRegistered(address indexed user, bytes32 indexed documentHash, string ipfsHash);

    // Function to register a document
    function registerDocument(bytes32 _passwordHash, bytes32 _documentHash, string memory _ipfsHash) public {
        require(!userDocuments[msg.sender][_documentHash].exists, "Document already registered");

        Document memory newDocument = Document({
            passwordHash: _passwordHash,
            documentHash: _documentHash,
            ipfsHash: _ipfsHash,
            exists: true
        });

        userDocuments[msg.sender][_documentHash] = newDocument;
        emit DocumentRegistered(msg.sender, _documentHash, _ipfsHash);
    }

    // Function to retrieve document details
    function getDocument(address _user, bytes32 _documentHash) public view returns (bytes32, string memory) {
        require(userDocuments[_user][_documentHash].exists, "Document not found");

        Document memory doc = userDocuments[_user][_documentHash];
        return (doc.passwordHash, doc.ipfsHash);
    }
}
